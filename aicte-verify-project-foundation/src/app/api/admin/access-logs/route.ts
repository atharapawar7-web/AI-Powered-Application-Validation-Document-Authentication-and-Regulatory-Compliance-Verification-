import { db } from "@/db";
import { accessLogs, users } from "@/db/schema";
import { requireUser } from "@/lib/route-guard";
import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request, { roles: ["admin", "officer"] });
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: accessLogs.id,
      action: accessLogs.action,
      resource: accessLogs.resource,
      httpMethod: accessLogs.httpMethod,
      success: accessLogs.success,
      details: accessLogs.details,
      ipAddress: accessLogs.ipAddress,
      createdAt: accessLogs.createdAt,
      userEmail: users.email,
      userRole: users.role,
    })
    .from(accessLogs)
    .leftJoin(users, eq(accessLogs.userId, users.id))
    .orderBy(desc(accessLogs.id))
    .limit(100);

  return Response.json({ logs: rows });
}
