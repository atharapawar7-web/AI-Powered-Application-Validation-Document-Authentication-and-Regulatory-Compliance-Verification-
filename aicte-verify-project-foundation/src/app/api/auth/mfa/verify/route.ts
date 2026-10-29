import { db } from "@/db";
import { users } from "@/db/schema";
import { writeAccessLog } from "@/lib/audit";
import { getClientIp } from "@/lib/http";
import { verifyTotp } from "@/lib/mfa";
import { requireUser } from "@/lib/route-guard";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as { code?: string };
  const code = body.code?.trim();

  if (!code) {
    return Response.json({ error: "MFA code is required." }, { status: 400 });
  }

  const rows = await db
    .select({ id: users.id, pendingSecret: users.mfaPendingSecret })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .limit(1);

  const user = rows[0];
  if (!user?.pendingSecret) {
    return Response.json({ error: "MFA setup not initialized." }, { status: 400 });
  }

  const valid = verifyTotp(code, user.pendingSecret);
  if (!valid) {
    await writeAccessLog({
      userId: auth.user.id,
      action: "mfa_setup_verify",
      resource: "/api/auth/mfa/verify",
      httpMethod: request.method,
      success: false,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      details: { reason: "invalid_totp" },
    });
    return Response.json({ error: "Invalid MFA code." }, { status: 400 });
  }

  await db
    .update(users)
    .set({ mfaEnabled: true, mfaSecret: user.pendingSecret, mfaPendingSecret: null })
    .where(eq(users.id, auth.user.id));

  await writeAccessLog({
    userId: auth.user.id,
    action: "mfa_setup_verify",
    resource: "/api/auth/mfa/verify",
    httpMethod: request.method,
    success: true,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return Response.json({ ok: true, mfaEnabled: true });
}
