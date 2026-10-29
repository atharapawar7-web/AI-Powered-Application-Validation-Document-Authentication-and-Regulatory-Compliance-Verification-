import { db } from "@/db";
import { users } from "@/db/schema";
import { writeAccessLog } from "@/lib/audit";
import { createSession } from "@/lib/auth";
import { getClientIp } from "@/lib/http";
import { verifyTotp } from "@/lib/mfa";
import { generateRandomToken, verifyPassword } from "@/lib/security";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    mfaCode?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }

  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = userRows[0];

  if (!user) {
    await writeAccessLog({
      action: "login",
      resource: "/api/auth/login",
      httpMethod: request.method,
      success: false,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      details: { email, reason: "user_not_found" },
    });
    return Response.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    await writeAccessLog({
      userId: user.id,
      action: "login",
      resource: "/api/auth/login",
      httpMethod: request.method,
      success: false,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      details: { email, reason: "invalid_password" },
    });
    return Response.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (user.mfaEnabled) {
    const code = body.mfaCode?.trim();
    if (!code) {
      return Response.json({ requiresMfa: true }, { status: 200 });
    }

    if (!user.mfaSecret || !verifyTotp(code, user.mfaSecret)) {
      await writeAccessLog({
        userId: user.id,
        action: "login_mfa",
        resource: "/api/auth/login",
        httpMethod: request.method,
        success: false,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        details: { reason: "invalid_totp" },
      });
      return Response.json({ error: "Invalid MFA code." }, { status: 401 });
    }
  }

  const token = generateRandomToken();
  await createSession(user.id, token);

  await writeAccessLog({
    userId: user.id,
    action: "login",
    resource: "/api/auth/login",
    httpMethod: request.method,
    success: true,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    details: { role: user.role },
  });

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
    },
  });
}
