import { prisma } from "@/lib/prisma";

export type AuthUser = { id: string };

async function getOrCreateSingleUser(): Promise<AuthUser> {
  const existing = await prisma.user.findFirst({ select: { id: true } });
  if (existing) return existing;
  const created = await prisma.user.create({ data: {}, select: { id: true } });
  return created;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  return getOrCreateSingleUser();
}

export async function requireAuth(): Promise<AuthUser> {
  return getOrCreateSingleUser();
}

export async function logout(): Promise<void> {
  // No-op — auth disabled
}
