import { db } from "@/db";
import { users } from "@/db/schema";
import { writeAccessLog } from "@/lib/audit";
import { getClientIp } from "@/lib/http";
import { createOtpAuthUri, createTotpSecret } from "@/lib/mfa";
import { requireUser } from "@/lib/route-guard";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const secret = createTotpSecret();
  const otpAuthUrl = createOtpAuthUri(auth.user.email, secret);

  await db
    .update(users)
    .set({ mfaPendingSecret: secret })
    .where(eq(users.id, auth.user.id));

  await writeAccessLog({
    userId: auth.user.id,
    action: "mfa_setup_init",
    resource: "/api/auth/mfa/setup",
    httpMethod: request.method,
    success: true,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return Response.json({ otpAuthUrl, secret });
}
