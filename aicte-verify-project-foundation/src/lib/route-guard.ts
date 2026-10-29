import { getCurrentTokenFromRequest, getCurrentUserFromCookies, hasRole, type UserRole } from "@/lib/auth";
import { getClientIp } from "@/lib/http";
import { writeAccessLog } from "@/lib/audit";
import { NextRequest } from "next/server";

export async function requireUser(request: NextRequest, options?: { roles?: UserRole[] }) {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    await writeAccessLog({
      action: "auth_required",
      resource: request.nextUrl.pathname,
      httpMethod: request.method,
      success: false,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      details: { reason: "missing_session" },
    });
    return { ok: false as const, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (options?.roles && !hasRole(user.role, options.roles)) {
    await writeAccessLog({
      userId: user.id,
      action: "forbidden",
      resource: request.nextUrl.pathname,
      httpMethod: request.method,
      success: false,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      details: { requiredRoles: options.roles, actualRole: user.role },
    });
    return { ok: false as const, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const token = await getCurrentTokenFromRequest(request);
  return { ok: true as const, user, token };
}
