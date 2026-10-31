import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { clubs } from "./tenancy";
import { invoiceStatus, notificationChannel, subscriptionStatus, planPeriod } from "./enums";

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
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  pdfUrl: text("pdf_url"),
  createdAt: createdAt(),
}, (t) => [index("platform_invoices_club_idx").on(t.clubId), check("platform_invoices_amount", sql`${t.amountKobo} >= 0`)]);

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
