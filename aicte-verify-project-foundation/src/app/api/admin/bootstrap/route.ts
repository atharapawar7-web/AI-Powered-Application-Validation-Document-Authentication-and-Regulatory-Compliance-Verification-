import { db } from "@/db";
import { users } from "@/db/schema";
import { seedFoundationFromYaml } from "@/lib/foundation";
import { writeAccessLog } from "@/lib/audit";
import { getClientIp } from "@/lib/http";
import { requireUser } from "@/lib/route-guard";
import { count } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userCountRows = await db.select({ total: count() }).from(users);
  const userCount = userCountRows[0]?.total ?? 0;
  let callerId: string | null = null;

  if (userCount > 0) {
    const auth = await requireUser(request, { roles: ["admin"] });
    if (!auth.ok) return auth.response;
    callerId = auth.user.id;
  }

  const summary = await seedFoundationFromYaml();

  await writeAccessLog({
    userId: callerId,
    action: "bootstrap_seed",
    resource: "/api/admin/bootstrap",
    httpMethod: request.method,
    success: true,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    details: summary,
  });

  return Response.json({ ok: true, summary });
}
