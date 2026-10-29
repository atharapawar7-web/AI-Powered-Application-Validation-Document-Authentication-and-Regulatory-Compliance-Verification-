import { db } from "@/db";
import { accessLogs } from "@/db/schema";

export async function writeAccessLog(input: {
  userId?: string | null;
  action: string;
  resource: string;
  httpMethod: string;
  success: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}) {
  await db.insert(accessLogs).values({
    userId: input.userId ?? null,
    action: input.action,
    resource: input.resource,
    httpMethod: input.httpMethod,
    success: input.success,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    details: input.details ?? {},
  });
}
