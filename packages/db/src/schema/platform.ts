import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { clubs } from "./tenancy";
import { invoiceStatus, issueSeverity, issueStatus, notificationChannel, notificationStatus, planPeriod, subscriptionStatus, templateKind } from "./enums";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Rallix platform billing. Club admins can read their own rows; only rallix_service writes. */
export const clubSubscriptions = pgTable("club_subscriptions", {
  id: id(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  period: planPeriod("period").notNull(),
  status: subscriptionStatus("status").notNull().default("trialing"),
  amountKobo: integer("amount_kobo").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  paystackSubscriptionCode: text("paystack_subscription_code"),
  createdAt: createdAt(),
}, (t) => [index("club_subscriptions_club_idx").on(t.clubId)]);

export const platformInvoices = pgTable("platform_invoices", {
  id: id(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  number: text("number").notNull().unique(),
  status: invoiceStatus("status").notNull().default("draft"),
  amountKobo: integer("amount_kobo").notNull(),
  periodLabel: text("period_label").notNull(),
  description: text("description"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentRef: text("payment_ref"),
  /* Unguessable token for the public pay-by-link page. Service-only. Null until a link is first created. */
  payToken: text("pay_token").unique(),
  payTokenRevokedAt: timestamp("pay_token_revoked_at", { withTimezone: true }),
  pdfUrl: text("pdf_url"),
  createdAt: createdAt(),
}, (t) => [
  index("platform_invoices_club_idx").on(t.clubId),
  unique("platform_invoices_club_period_uq").on(t.clubId, t.periodLabel),
  check("platform_invoices_amount", sql`${t.amountKobo} >= 0`),
]);

/* The tables below are console-only. The app role has no privileges on them. */
export const platformAdmins = pgTable("platform_admins", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  audience: jsonb("audience").notNull(), // e.g. {"clubs":["..."],"roles":["admin"]}
  channel: notificationChannel("channel").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: notificationStatus("status").notNull().default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  failureReason: text("failure_reason"),
  createdBy: text("created_by").references(() => users.id),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  meta: jsonb("meta"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_log_at_idx").on(t.at)]);

export const globalRatings = pgTable("global_ratings", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull().default(1200),
  matchesPlayed: integer("matches_played").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Support and bug tracker for the platform team. */
export const issues = pgTable("issues", {
  id: id(),
  title: text("title").notNull(),
  body: text("body"),
  severity: issueSeverity("severity").notNull().default("normal"),
  status: issueStatus("status").notNull().default("open"),
  clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
  reportedBy: text("reported_by").references(() => users.id, { onDelete: "set null" }),
  assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => [index("issues_status_idx").on(t.status, t.severity), index("issues_club_idx").on(t.clubId)]);

export const issueNotes = pgTable("issue_notes", {
  id: id(),
  issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
}, (t) => [index("issue_notes_issue_idx").on(t.issueId)]);

/** Editable message templates. Placeholders look like {{club_name}}. */
export const templates = pgTable("templates", {
  id: id(),
  key: text("key").notNull().unique(),
  kind: templateKind("kind").notNull(),
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Single-row platform settings (id is always 1). Branding and numbering for invoices. */
export const platformSettings = pgTable("platform_settings", {
  id: integer("id").primaryKey().default(1),
  companyName: text("company_name").notNull().default("Rallix"),
  address: text("address").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  invoicePrefix: text("invoice_prefix").notNull().default("RLX"),
  invoiceNext: integer("invoice_next").notNull().default(1),
  vatPercent: integer("vat_percent").notNull().default(0),
  footerNote: text("footer_note").notNull().default("Thank you for using Rallix."),
  paymentInstructions: text("payment_instructions").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("platform_settings_single", sql`${t.id} = 1`), check("platform_settings_vat", sql`${t.vatPercent} BETWEEN 0 AND 100`)]);

/** Attempts to pay a Rallix invoice online. Service role only. */
export const invoicePayments = pgTable("invoice_payments", {
  id: id(),
  invoiceId: uuid("invoice_id").notNull().references(() => platformInvoices.id, { onDelete: "cascade" }),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  amountKobo: integer("amount_kobo").notNull(),
  status: text("status").notNull().default("pending"),
  initiatedBy: text("initiated_by").references(() => users.id, { onDelete: "set null" }),
  /** True when paid through the public pay link (no signed-in user). */
  viaLink: boolean("via_link").notNull().default(false),
  payerEmail: text("payer_email"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  raw: jsonb("raw"),
  createdAt: createdAt(),
}, (t) => [
  index("invoice_payments_invoice_idx").on(t.invoiceId),
  check("invoice_payments_status", sql`${t.status} IN ('pending','paid','failed')`),
  check("invoice_payments_amount", sql`${t.amountKobo} > 0`),
]);

/** Every webhook delivery we receive, valid or not. Service role only. Used for troubleshooting, never for crediting decisions. */
export const paymentEvents = pgTable("payment_events", {
  id: id(),
  provider: text("provider").notNull(),
  event: text("event").notNull(),
  reference: text("reference"),
  signatureValid: boolean("signature_valid").notNull(),
  outcome: text("outcome").notNull(), // credited | already_processed | duplicate_payment | rejected_signature | rejected_mismatch | unknown_reference | ignored | error
  detail: text("detail"),
  raw: jsonb("raw"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("payment_events_ref_idx").on(t.reference), index("payment_events_received_idx").on(t.receivedAt)]);

/** Every email we try to send, for troubleshooting. Never stores codes or message bodies. Service role only. */
export const emailLog = pgTable("email_log", {
  id: id(),
  toEmail: text("to_email").notNull(),
  kind: text("kind").notNull(), // otp | invoice | reminder | broadcast
  templateKey: text("template_key"),
  status: text("status").notNull(), // sent | failed
  error: text("error"),
  relatedId: text("related_id"), // invoice id, notification id...
  createdAt: createdAt(),
}, (t) => [
  index("email_log_related_idx").on(t.relatedId, t.createdAt),
  index("email_log_created_idx").on(t.createdAt),
  check("email_log_kind", sql`${t.kind} IN ('otp','invoice','reminder','broadcast')`),
  check("email_log_status", sql`${t.status} IN ('sent','failed')`),
]);

/** One row per recipient of a notification. Lets a large send be resumed and failures retried. Service role only. */
export const notificationDeliveries = pgTable("notification_deliveries", {
  id: id(),
  notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"), // pending | sent | failed
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => [
  unique("notification_deliveries_uq").on(t.notificationId, t.userId),
  index("notification_deliveries_pending_idx").on(t.notificationId, t.status),
  check("notification_deliveries_status", sql`${t.status} IN ('pending','sent','failed')`),
]);

/** One row per accepted picture upload, for a per-person daily limit. Service role only (no app-role grants). */
export const uploadLog = pgTable("upload_log", {
  id: id(),
  userId: text("user_id").notNull(),
  clubId: uuid("club_id"),
  kind: text("kind").notNull(), // person | club-logo | club-cover
  bytes: integer("bytes").notNull(),
  createdAt: createdAt(),
}, (t) => [
  index("upload_log_user_idx").on(t.userId, t.createdAt),
  check("upload_log_kind", sql`${t.kind} IN ('person','club-logo','club-cover')`),
]);
