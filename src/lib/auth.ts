import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "qm_lf_sess";

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function hmac(payloadB64: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export type AuthUser = { id: string };

type SessionPayload = {
  userId: string;
  exp: number; // epoch seconds
};

export async function getOrCreateSingleUser(): Promise<AuthUser> {
  const existing = await prisma.user.findFirst({ select: { id: true } });
  if (existing) return existing;
  const created = await prisma.user.create({ data: {}, select: { id: true } });
  return created;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const [payloadB64, sig] = raw.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = hmac(payloadB64, secret);
  if (!timingSafeEqual(expected, sig)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64)) as SessionPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload?.userId || !payload?.exp || payload.exp < now) return null;

  return { id: payload.userId };
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

export async function loginWithPassword(password: string): Promise<void> {
  const appPassword = mustGetEnv("APP_PASSWORD");

  // Hash on both sides so we never do a direct string compare on the raw password.
  // This is still single-factor auth and intended only for single-user beta instances.
  const secret = mustGetEnv("AUTH_SECRET");
  const storedHash = crypto.createHash("sha256").update(appPassword + secret).digest("hex");
  const inputHash = crypto.createHash("sha256").update(password + secret).digest("hex");

  if (!timingSafeEqual(storedHash, inputHash)) {
    throw new Error("Invalid password");
  }

  const user = await getOrCreateSingleUser();
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days

  const payload: SessionPayload = { userId: user.id, exp };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const token = `${payloadB64}.${hmac(payloadB64, secret)}`;

  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function logout(): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
