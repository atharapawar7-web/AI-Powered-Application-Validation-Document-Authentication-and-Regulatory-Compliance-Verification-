import { clearSession, getCurrentTokenFromRequest } from "@/lib/auth";
import { writeAccessLog } from "@/lib/audit";
import { getClientIp } from "@/lib/http";
import { requireUser } from "@/lib/route-guard";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const token = await getCurrentTokenFromRequest(request);
  await clearSession(token);

  await writeAccessLog({
    userId: auth.user.id,
    action: "logout",
    resource: "/api/auth/logout",
    httpMethod: request.method,
    success: true,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return Response.json({ ok: true });
}
