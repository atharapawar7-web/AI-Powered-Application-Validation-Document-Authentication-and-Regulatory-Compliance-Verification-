import { db } from "@/db";
import { sessions, users, userRoleEnum } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { sha256 } from "@/lib/security";

const SESSION_COOKIE = "aicte_verify_session";
const SESSION_TTL_DAYS = 7;

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  institutionId: string | null;
  mfaEnabled: boolean;
};

export async function createSession(userId: string, rawToken: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(rawToken),
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession(rawToken?: string | null) {
  if (rawToken) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(rawToken)));
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUserFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      institutionId: users.institutionId,
      mfaEnabled: users.mfaEnabled,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.sessionId));

  return {
    id: row.userId,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    institutionId: row.institutionId,
    mfaEnabled: row.mfaEnabled,
  };
}

export async function getCurrentTokenFromRequest(request: NextRequest): Promise<string | null> {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export function hasRole(userRole: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(userRole);
}
