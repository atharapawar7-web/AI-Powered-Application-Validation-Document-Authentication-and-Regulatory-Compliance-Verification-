import { db } from "@/db";
import {
  applicationCategories,
  applicationDocuments,
  applications,
  categoryChecklistItems,
  institutions,
  mockAicteRecords,
} from "@/db/schema";
import { requireUser } from "@/lib/route-guard";
import { and, count, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request, { roles: ["admin", "officer", "institution"] });
  if (!auth.ok) return auth.response;

  const categories = await db.select().from(applicationCategories);
  const checklistItems = await db.select().from(categoryChecklistItems);

  const institutionRows =
    auth.user.role === "institution" && auth.user.institutionId
      ? await db
          .select()
          .from(institutions)
          .where(eq(institutions.id, auth.user.institutionId))
      : await db.select().from(institutions);

  const recordsCount =
    auth.user.role === "institution" && auth.user.institutionId
      ? await db
          .select({ total: count() })
          .from(mockAicteRecords)
          .where(eq(mockAicteRecords.institutionId, auth.user.institutionId))
      : await db.select({ total: count() }).from(mockAicteRecords);

  const applicationsCount =
    auth.user.role === "institution" && auth.user.institutionId
      ? await db
          .select({ total: count() })
          .from(applications)
          .where(eq(applications.institutionId, auth.user.institutionId))
      : await db.select({ total: count() }).from(applications);

  const flaggedDocsCount =
    auth.user.role === "institution" && auth.user.institutionId
      ? await db
          .select({ total: count() })
          .from(applicationDocuments)
          .where(
            and(
              eq(applicationDocuments.institutionId, auth.user.institutionId),
              eq(applicationDocuments.isTampered, true),
            ),
          )
      : await db
          .select({ total: count() })
          .from(applicationDocuments)
          .where(eq(applicationDocuments.isTampered, true));

  return Response.json({
    principle: "AI recommends - Evidence explains - Officials decide",
    note: "All anomalies are indicators only, not proof. No auto-reject is performed.",
    categories,
    checklistItems,
    institutions: institutionRows,
    totals: {
      records: recordsCount[0]?.total ?? 0,
      applications: applicationsCount[0]?.total ?? 0,
      tamperIndicators: flaggedDocsCount[0]?.total ?? 0,
    },
  });
}
