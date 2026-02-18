import { NextRequest } from "next/server";
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
  const formData = await request.formData();
  const password = String(formData.get("password") || "");

  const appPassword = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!appPassword || !secret) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const storedHash = crypto.createHash("sha256").update(appPassword + secret).digest("hex");
  const inputHash = crypto.createHash("sha256").update(password + secret).digest("hex");

  if (!timingSafeEqual(storedHash, inputHash)) {
    const url = new URL("/login?error=invalid", request.url);
    return Response.redirect(url.toString(), 303);
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

  const cookie = `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=${60 * 60 * 24 * 7}`;
  const redirectUrl = new URL("/projects", request.url);

  console.log("[auth] setting cookie via raw Set-Cookie header for user", user.id);

  return new Response(null, {
    status: 303,
    headers: {
      Location: redirectUrl.toString(),
      "Set-Cookie": cookie,
    },
  });
}
