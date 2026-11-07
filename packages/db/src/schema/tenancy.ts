import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, index, integer, pgTable, smallint, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { clubStatus, level, memberRole, memberStatus, suspensionReason } from "./enums";

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
  /* The club's usual match rules, pre-filled for new competitions. Admins change them (clubs_update policy). */
  defaultBestOf: smallint("default_best_of").notNull().default(5),
  defaultGamePoints: smallint("default_game_points").notNull().default(11),
  defaultWinBy: smallint("default_win_by").notNull().default(2),
  defaultPointCap: smallint("default_point_cap"),
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
  check("clubs_default_best_of", sql`${t.defaultBestOf} IN (1,3,5,7,9)`),
  check("clubs_default_game_points", sql`${t.defaultGamePoints} BETWEEN 5 AND 30`),
  check("clubs_default_win_by", sql`${t.defaultWinBy} IN (1,2)`),
  check("clubs_default_point_cap", sql`${t.defaultPointCap} IS NULL OR (${t.defaultWinBy} = 2 AND ${t.defaultPointCap} > ${t.defaultGamePoints} AND ${t.defaultPointCap} <= ${t.defaultGamePoints} + 20)`),
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
  /* What an admin looks after: members, competitions, finance, facilities. The club owner (clubs.owner_id) always has all of them.
     Changed only through app.set_admin / app.remove_admin, which only the owner can call. */
  permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [
  unique("memberships_club_user_uq").on(t.clubId, t.userId),
  unique("memberships_id_club_uq").on(t.id, t.clubId),
  index("memberships_user_idx").on(t.userId),
  check("memberships_roles_nonempty", sql`cardinality(${t.roles}) > 0`),
  check("memberships_permissions_known", sql`${t.permissions} <@ ARRAY['members','competitions','finance','facilities']::text[]`),
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


/**
 * What a club tells people before they join: the public face of the club, written by its admins.
 * Fees are not stored here, they come from the club's plans. Members can read it; people outside the club read the published
 * version through a service-side lookup that returns only these columns plus the club's name and pictures.
 */
export const clubPages = pgTable("club_pages", {
  clubId: uuid("club_id").primaryKey().references(() => clubs.id, { onDelete: "cascade" }),
  about: text("about"),
  schedule: text("schedule"), // when we play, meeting times
  dressCode: text("dress_code"),
  equipment: text("equipment"), // bring your own racket? how to get one
  rules: text("rules"), // rules and guidelines
  contact: text("contact"),
  /** review: people apply and an admin decides. open: people join straight away after reading the page. */
  joinMode: text("join_mode").notNull().default("review"),
  published: boolean("published").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("club_pages_join_mode", sql`${t.joinMode} IN ('review','open')`),
  check("club_pages_lengths", sql`char_length(coalesce(${t.about}, '')) <= 1000 AND char_length(coalesce(${t.schedule}, '')) <= 2000 AND char_length(coalesce(${t.dressCode}, '')) <= 1000 AND char_length(coalesce(${t.equipment}, '')) <= 1000 AND char_length(coalesce(${t.rules}, '')) <= 8000 AND char_length(coalesce(${t.contact}, '')) <= 500`),
]);

/** Someone asked to join a club that reviews applications. Created and decided only through app.apply_to_club / app.decide_application. */
export const membershipApplications = pgTable("membership_applications", {
  id: id(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  level: level("level").notNull().default("junior"),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  decidedBy: uuid("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("applications_one_pending").on(t.clubId, t.userId).where(sql`${t.status} = 'pending'`),
  index("applications_club_idx").on(t.clubId, t.status, t.createdAt),
  index("applications_user_idx").on(t.userId, t.createdAt),
  check("applications_status", sql`${t.status} IN ('pending','approved','declined','withdrawn')`),
  check("applications_message", sql`${t.message} IS NULL OR char_length(${t.message}) <= 500`),
  check("applications_note", sql`${t.decisionNote} IS NULL OR char_length(${t.decisionNote}) <= 300`),
]);
