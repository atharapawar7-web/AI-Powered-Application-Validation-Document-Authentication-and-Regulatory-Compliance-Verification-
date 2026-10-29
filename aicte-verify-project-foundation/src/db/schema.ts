import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "officer", "institution"]);

export const applicationStatusEnum = pgEnum("application_status", [
  "draft",
  "submitted",
  "under_review",
  "manual_review",
  "approved",
  "rejected",
  "needs_info",
]);

export const docVerificationStatusEnum = pgEnum("doc_verification_status", [
  "pending",
  "verified",
  "mismatch",
  "expired",
  "source_unavailable",
  "manual_review_required",
]);

export const institutions = pgTable("institutions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  state: varchar("state", { length: 120 }).notNull(),
  status: varchar("status", { length: 120 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  mfaPendingSecret: text("mfa_pending_secret"),
  institutionId: uuid("institution_id").references(() => institutions.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const applicationCategories = pgTable("application_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categoryChecklistItems = pgTable("category_checklist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => applicationCategories.id, { onDelete: "cascade" }),
  itemKey: varchar("item_key", { length: 120 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  required: boolean("required").notNull().default(true),
  documentType: varchar("document_type", { length: 120 }).notNull(),
  validationHints: jsonb("validation_hints").$type<Record<string, unknown>>().notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => applicationCategories.id, { onDelete: "restrict" }),
  status: applicationStatusEnum("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const applicationDocuments = pgTable("application_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 120 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUri: text("file_uri").notNull(),
  issuedOn: timestamp("issued_on", { withTimezone: true }),
  expiresOn: timestamp("expires_on", { withTimezone: true }),
  isTampered: boolean("is_tampered").notNull().default(false),
  isExpired: boolean("is_expired").notNull().default(false),
  isMissing: boolean("is_missing").notNull().default(false),
  isMismatched: boolean("is_mismatched").notNull().default(false),
  verificationStatus: docVerificationStatusEnum("verification_status").notNull().default("pending"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mockAicteRecords = pgTable("mock_aicte_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  recordType: varchar("record_type", { length: 120 }).notNull(),
  referenceNumber: varchar("reference_number", { length: 255 }).notNull(),
  issueDate: timestamp("issue_date", { withTimezone: true }),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  status: varchar("status", { length: 120 }).notNull(),
  source: varchar("source", { length: 120 }).notNull().default("mock_aicte_registry"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accessLogs = pgTable("access_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  resource: varchar("resource", { length: 255 }).notNull(),
  httpMethod: varchar("http_method", { length: 10 }).notNull(),
  success: boolean("success").notNull(),
  ipAddress: varchar("ip_address", { length: 120 }),
  userAgent: text("user_agent"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const institutionsRelations = relations(institutions, ({ many }) => ({
  users: many(users),
  records: many(mockAicteRecords),
  applications: many(applications),
  documents: many(applicationDocuments),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [users.institutionId],
    references: [institutions.id],
  }),
  sessions: many(sessions),
  accessLogs: many(accessLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const categoryRelations = relations(applicationCategories, ({ many }) => ({
  checklistItems: many(categoryChecklistItems),
  applications: many(applications),
}));

export const checklistItemRelations = relations(categoryChecklistItems, ({ one }) => ({
  category: one(applicationCategories, {
    fields: [categoryChecklistItems.categoryId],
    references: [applicationCategories.id],
  }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [applications.institutionId],
    references: [institutions.id],
  }),
  category: one(applicationCategories, {
    fields: [applications.categoryId],
    references: [applicationCategories.id],
  }),
  documents: many(applicationDocuments),
}));

export const applicationDocumentsRelations = relations(applicationDocuments, ({ one }) => ({
  application: one(applications, {
    fields: [applicationDocuments.applicationId],
    references: [applications.id],
  }),
  institution: one(institutions, {
    fields: [applicationDocuments.institutionId],
    references: [institutions.id],
  }),
}));

export const mockAicteRecordsRelations = relations(mockAicteRecords, ({ one }) => ({
  institution: one(institutions, {
    fields: [mockAicteRecords.institutionId],
    references: [institutions.id],
  }),
}));

export const accessLogsRelations = relations(accessLogs, ({ one }) => ({
  user: one(users, {
    fields: [accessLogs.userId],
    references: [users.id],
  }),
}));
