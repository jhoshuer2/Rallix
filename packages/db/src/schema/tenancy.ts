import { sql } from "drizzle-orm";
import { check, doublePrecision, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { clubStatus, memberRole, memberStatus, suspensionReason } from "./enums";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const clubs = pgTable("clubs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  /** Wide banner picture. Uploaded by a club admin; app-role writes are limited to admins by the clubs_update policy. */
  coverUrl: text("cover_url"),
  location: text("location"),
  /* Court location for arrival check-in. Set by a club admin (clubs_update policy). Never stores any player's position. */
  venueLabel: text("venue_label"),
  venueLat: doublePrecision("venue_lat"),
  venueLng: doublePrecision("venue_lng"),
  venueRadiusM: integer("venue_radius_m").notNull().default(100),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  status: clubStatus("status").notNull().default("active"),
  /* Why the platform suspended this club. Console-written, service-only: decides whether paying an overdue invoice reactivates it. */
  suspensionReason: suspensionReason("suspension_reason"),
  ownerId: text("owner_id").notNull().references(() => users.id),
  /* Online dues payouts. Written only by the service role after the account is verified with the provider;
     the app role cannot read the subaccount code or bank details and cannot write any of these columns. */
  paystackSubaccountCode: text("paystack_subaccount_code"),
  payoutBankName: text("payout_bank_name"),
  payoutBankCode: text("payout_bank_code"),
  payoutAccountName: text("payout_account_name"),
  payoutAccountLast4: text("payout_account_last4"),
  payoutsEnabledAt: timestamp("payouts_enabled_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  check("clubs_payouts_need_subaccount", sql`${t.payoutsEnabledAt} IS NULL OR ${t.paystackSubaccountCode} IS NOT NULL`),
  // Slug becomes the subdomain, so keep it DNS-safe.
  check("clubs_slug_format", sql`${t.slug} ~ '^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$'`),
  check("clubs_logo_url", sql`${t.logoUrl} IS NULL OR ${t.logoUrl} ~ '^(https://[^ ]+|/[^/ ][^ ]*)$'`),
  check("clubs_venue_point", sql`(${t.venueLat} IS NULL) = (${t.venueLng} IS NULL) AND (${t.venueLat} IS NULL OR (${t.venueLat} BETWEEN -90 AND 90 AND ${t.venueLng} BETWEEN -180 AND 180))`),
  check("clubs_venue_radius", sql`${t.venueRadiusM} BETWEEN 25 AND 500`),
  check("clubs_cover_url", sql`${t.coverUrl} IS NULL OR ${t.coverUrl} ~ '^(https://[^ ]+|/[^/ ][^ ]*)$'`),
]);

/** A user's identity inside one club. All club data points at memberships.id, never users.id. */
export const memberships = pgTable("memberships", {
  id: id(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roles: memberRole("roles").array().notNull().default(sql`ARRAY['player']::member_role[]`),
  status: memberStatus("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [
  unique("memberships_club_user_uq").on(t.clubId, t.userId),
  unique("memberships_id_club_uq").on(t.id, t.clubId),
  index("memberships_user_idx").on(t.userId),
  check("memberships_roles_nonempty", sql`cardinality(${t.roles}) > 0`),
]);

export const invites = pgTable("invites", {
  id: id(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  role: memberRole("role").notNull().default("player"),
  createdBy: uuid("created_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  uses: integer("uses").notNull().default(0),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  index("invites_club_idx").on(t.clubId),
  check("invites_uses_nonneg", sql`${t.uses} >= 0`),
]);
