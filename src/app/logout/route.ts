import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await logout();
  return NextResponse.redirect(new URL("/login", request.url));
}
