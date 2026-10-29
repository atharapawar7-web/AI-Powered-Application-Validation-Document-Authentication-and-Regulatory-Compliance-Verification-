import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/route-guard";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      institutionId: users.institutionId,
      mfaEnabled: users.mfaEnabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .limit(1);

  if (!rows[0]) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  return Response.json({ user: rows[0] });
}
