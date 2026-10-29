import { db } from "@/db";
import { institutions, users } from "@/db/schema";
import { writeAccessLog } from "@/lib/audit";
import { createSession } from "@/lib/auth";
import { getClientIp } from "@/lib/http";
import { generateRandomToken, hashPassword } from "@/lib/security";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    fullName?: string;
    password?: string;
    institutionCode?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  const password = body.password ?? "";

  if (!email || !fullName || password.length < 8) {
    return Response.json(
      { error: "Email, full name and password (min 8 chars) are required." },
      { status: 400 },
    );
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    return Response.json({ error: "User already exists." }, { status: 409 });
  }

  let institutionId: string | null = null;
  if (body.institutionCode) {
    const instRows = await db
      .select({ id: institutions.id })
      .from(institutions)
      .where(eq(institutions.code, body.institutionCode))
      .limit(1);
    institutionId = instRows[0]?.id ?? null;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      fullName,
      role: institutionId ? "institution" : "officer",
      passwordHash: await hashPassword(password),
      institutionId,
    })
    .returning({ id: users.id, role: users.role, email: users.email, fullName: users.fullName });

  const token = generateRandomToken();
  await createSession(newUser.id, token);

  await writeAccessLog({
    userId: newUser.id,
    action: "register",
    resource: "/api/auth/register",
    httpMethod: request.method,
    success: true,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    details: { role: newUser.role },
  });

  return Response.json({ user: newUser });
}
