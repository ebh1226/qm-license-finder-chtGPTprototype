import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "qm_lf_sess";

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function hmacSign(payloadB64: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = String(body.password || "");

  const appPassword = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!appPassword || !secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const storedHash = crypto.createHash("sha256").update(appPassword + secret).digest("hex");
  const inputHash = crypto.createHash("sha256").update(password + secret).digest("hex");

  if (!timingSafeEqual(storedHash, inputHash)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Get or create single user
  let user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    user = await prisma.user.create({ data: {}, select: { id: true } });
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = { userId: user.id, exp };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const token = `${payloadB64}.${hmacSign(payloadB64, secret)}`;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  console.log("[auth] cookie set via route handler for user", user.id);
  return response;
}
