import { db } from "@/db";
import {
  applicationCategories,
  applicationDocuments,
  applications,
  categoryChecklistItems,
  institutions,
  mockAicteRecords,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/security";
import { readConfigYaml } from "@/lib/yaml-config";
import { eq } from "drizzle-orm";

type CategoryYaml = {
  version: number;
  updated_at: string;
  categories: Array<{
    key: string;
    name: string;
    description: string;
    checklist: Array<{
      item_key: string;
      title: string;
      description: string;
      required: boolean;
      document_type: string;
      validation_hints?: Record<string, unknown>;
    }>;
  }>;
};

type SyntheticYaml = {
  version: number;
  updated_at: string;
  users: Array<{
    email: string;
    full_name: string;
    role: "admin" | "officer";
    password: string;
    mfa_enabled: boolean;
  }>;
  institutions: Array<{
    code: string;
    name: string;
    state: string;
    status: string;
    users: Array<{
      email: string;
      full_name: string;
      role: "institution";
      password: string;
      mfa_enabled: boolean;
    }>;
  }>;
  records: Array<{
    institution_code: string;
    record_type: string;
    reference_number: string;
    issue_date: string | null;
    expiry_date: string | null;
    status: string;
    payload?: Record<string, unknown>;
  }>;
  document_templates: Array<{
    document_type: string;
    file_name: string;
    file_uri: string;
    flags: {
      is_tampered: boolean;
      is_expired: boolean;
      is_missing: boolean;
      is_mismatched: boolean;
    };
    verification_status:
      | "pending"
      | "verified"
      | "mismatch"
      | "expired"
      | "source_unavailable"
      | "manual_review_required";
  }>;
};

function parseDateOrNull(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export async function seedFoundationFromYaml() {
  const categoriesConfig = await readConfigYaml<CategoryYaml>("application_categories.yaml");
  const syntheticConfig = await readConfigYaml<SyntheticYaml>("synthetic_dataset.yaml");

  return db.transaction(async (tx) => {
    await tx.delete(applicationDocuments);
    await tx.delete(applications);
    await tx.delete(mockAicteRecords);
    await tx.delete(categoryChecklistItems);
    await tx.delete(applicationCategories);

    const categoryIdByKey = new Map<string, string>();

    for (const category of categoriesConfig.categories) {
      const [insertedCategory] = await tx
        .insert(applicationCategories)
        .values({
          key: category.key,
          name: category.name,
          description: category.description,
          isActive: true,
        })
        .returning({ id: applicationCategories.id });

      categoryIdByKey.set(category.key, insertedCategory.id);

      for (const [index, item] of category.checklist.entries()) {
        await tx.insert(categoryChecklistItems).values({
          categoryId: insertedCategory.id,
          itemKey: item.item_key,
          title: item.title,
          description: item.description,
          required: item.required,
          documentType: item.document_type,
          validationHints: item.validation_hints ?? {},
          sortOrder: index,
        });
      }
    }

    await tx.delete(users);
    await tx.delete(institutions);

    const institutionIdByCode = new Map<string, string>();

    for (const institution of syntheticConfig.institutions) {
      const [insertedInstitution] = await tx
        .insert(institutions)
        .values({
          code: institution.code,
          name: institution.name,
          state: institution.state,
          status: institution.status,
        })
        .returning({ id: institutions.id });

      institutionIdByCode.set(institution.code, insertedInstitution.id);

      for (const user of institution.users) {
        await tx.insert(users).values({
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          passwordHash: await hashPassword(user.password),
          mfaEnabled: user.mfa_enabled,
          institutionId: insertedInstitution.id,
        });
      }
    }

    for (const user of syntheticConfig.users) {
      await tx.insert(users).values({
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        passwordHash: await hashPassword(user.password),
        mfaEnabled: user.mfa_enabled,
      });
    }

    for (const record of syntheticConfig.records) {
      const institutionId = institutionIdByCode.get(record.institution_code);
      if (!institutionId) continue;

      await tx.insert(mockAicteRecords).values({
        institutionId,
        recordType: record.record_type,
        referenceNumber: record.reference_number,
        issueDate: parseDateOrNull(record.issue_date),
        expiryDate: parseDateOrNull(record.expiry_date),
        status: record.status,
        payload: record.payload ?? {},
      });
    }

    const categories = await tx
      .select({ id: applicationCategories.id, key: applicationCategories.key })
      .from(applicationCategories);

    const eoaCategoryId = categories.find((c) => c.key === "eoa_extension")?.id ?? categories[0]?.id;

    if (eoaCategoryId) {
      for (const institution of syntheticConfig.institutions) {
        const institutionId = institutionIdByCode.get(institution.code);
        if (!institutionId) continue;

        const [insertedApplication] = await tx
          .insert(applications)
          .values({
            institutionId,
            categoryId: eoaCategoryId,
            status: "submitted",
            submittedAt: new Date(),
          })
          .returning({ id: applications.id });

        for (const template of syntheticConfig.document_templates) {
          await tx.insert(applicationDocuments).values({
            applicationId: insertedApplication.id,
            institutionId,
            documentType: template.document_type,
            fileName: template.file_name,
            fileUri: template.file_uri,
            isTampered: template.flags.is_tampered,
            isExpired: template.flags.is_expired,
            isMissing: template.flags.is_missing,
            isMismatched: template.flags.is_mismatched,
            verificationStatus: template.verification_status,
            metadata: {
              seedVersion: syntheticConfig.version,
              note: "Synthetic document for Phase 1 testing",
            },
          });
        }
      }
    }

    return {
      categoryCount: categoriesConfig.categories.length,
      institutionCount: syntheticConfig.institutions.length,
      systemUserCount:
        syntheticConfig.users.length +
        syntheticConfig.institutions.reduce((sum: number, inst) => sum + inst.users.length, 0),
      recordCount: syntheticConfig.records.length,
      documentTemplateCount: syntheticConfig.document_templates.length,
    };
  });
}

export async function getUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}
