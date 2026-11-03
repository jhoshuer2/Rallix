import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, jsonb, pgTable, smallint, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { clubs, memberships } from "./tenancy";
import { competitionFormat, competitionStatus, dueStatus, level, matchStatus, paymentStatus, planPeriod, ratingScope } from "./enums";

const id = () => uuid("id").primaryKey().defaultRandom();
const clubId = () => uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* Every table below carries club_id, and every reference to another club-scoped row is a
   composite foreign key (id, club_id), so a row can never point into another club. */

export const playerProfiles = pgTable("player_profiles", {
  membershipId: uuid("membership_id").primaryKey(),
  clubId: clubId(),
  level: level("level").notNull().default("junior"),
  dateOfBirth: date("date_of_birth"),
  heightCm: smallint("height_cm"),
  country: text("country").notNull().default("NGR"),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  /* Arrival check-in, all opt-in and per club. */
  shareArrival: boolean("share_arrival").notNull().default(false),
  notifyArrivals: boolean("notify_arrivals").notNull().default(false),
  autoArrival: boolean("auto_arrival").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "player_profiles_membership_fk" }).onDelete("cascade"),
  check("player_profiles_height", sql`${t.heightCm} IS NULL OR ${t.heightCm} BETWEEN 80 AND 260`),
  // A picture address must be a web address or one of our own paths, never javascript: or data: (it ends up in <img src>).
  check("player_profiles_photo_url", sql`${t.photoUrl} IS NULL OR ${t.photoUrl} ~ '^(https://[^ ]+|/[^/ ][^ ]*)$'`),
]);

export const plans = pgTable("plans", {
  id: id(),
  clubId: clubId(),
  name: text("name").notNull(),
  priceKobo: integer("price_kobo").notNull(),
  currency: text("currency").notNull().default("NGN"),
  period: planPeriod("period").notNull(),
  perks: text("perks").array().notNull().default(sql`ARRAY[]::text[]`),
  active: boolean("active").notNull().default(true),
  paystackPlanCode: text("paystack_plan_code"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique("plans_id_club_uq").on(t.id, t.clubId),
  unique("plans_club_name_period_uq").on(t.clubId, t.name, t.period),
  check("plans_price_nonneg", sql`${t.priceKobo} >= 0`),
]);

export const dues = pgTable("dues", {
  id: id(),
  clubId: clubId(),
  membershipId: uuid("membership_id").notNull(),
  planId: uuid("plan_id").notNull(),
  amountKobo: integer("amount_kobo").notNull(),
  periodLabel: text("period_label").notNull(),
  dueDate: date("due_date").notNull(),
  status: dueStatus("status").notNull().default("due"),
  createdAt: createdAt(),
}, (t) => [
  unique("dues_id_club_uq").on(t.id, t.clubId),
  unique("dues_member_plan_period_uq").on(t.membershipId, t.planId, t.periodLabel),
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "dues_membership_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.planId, t.clubId], foreignColumns: [plans.id, plans.clubId], name: "dues_plan_fk" }),
  index("dues_club_status_idx").on(t.clubId, t.status),
  check("dues_amount_nonneg", sql`${t.amountKobo} >= 0`),
]);

export const payments = pgTable("payments", {
  id: id(),
  clubId: clubId(),
  membershipId: uuid("membership_id").notNull(),
  dueId: uuid("due_id"),
  amountKobo: integer("amount_kobo").notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  provider: text("provider").notNull().default("paystack"),
  providerRef: text("provider_ref").notNull().unique(),
  method: text("method"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  raw: jsonb("raw"),
  createdAt: createdAt(),
}, (t) => [
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "payments_membership_fk" }),
  foreignKey({ columns: [t.dueId, t.clubId], foreignColumns: [dues.id, dues.clubId], name: "payments_due_fk" }),
  index("payments_club_status_idx").on(t.clubId, t.status),
  check("payments_amount_pos", sql`${t.amountKobo} > 0`),
]);

export const competitions = pgTable("competitions", {
  id: id(),
  clubId: clubId(),
  name: text("name").notNull(),
  level: level("level"), // null = combined levels
  format: competitionFormat("format").notNull(),
  status: competitionStatus("status").notNull().default("draft"),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  /* Preview page, all optional and admin-written (admin_write policy). A draft with open_registration is the sign-up phase. */
  summary: text("summary"),
  prize: text("prize"),
  rules: text("rules"),
  coverUrl: text("cover_url"),
  openRegistration: boolean("open_registration").notNull().default(false),
  /* How seeds were decided when it started: by rating, or a random raffle. drawnAt is set once. */
  drawMethod: text("draw_method").notNull().default("seeded"),
  drawnAt: timestamp("drawn_at", { withTimezone: true }),
  /* League points: what a win and a loss are worth in this competition. */
  pointsWin: smallint("points_win").notNull().default(3),
  pointsLoss: smallint("points_loss").notNull().default(0),
  seasonId: uuid("season_id"),
  maxPlayers: smallint("max_players"),
  registrationClosesOn: date("registration_closes_on"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique("competitions_id_club_uq").on(t.id, t.clubId),
  index("competitions_club_status_idx").on(t.clubId, t.status),
  check("competitions_dates", sql`${t.endsOn} IS NULL OR ${t.startsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`),
  check("competitions_summary", sql`${t.summary} IS NULL OR char_length(${t.summary}) <= 140`),
  check("competitions_prize", sql`${t.prize} IS NULL OR char_length(${t.prize}) <= 100`),
  check("competitions_rules", sql`${t.rules} IS NULL OR char_length(${t.rules}) <= 8000`),
  check("competitions_points", sql`${t.pointsWin} BETWEEN 0 AND 10 AND ${t.pointsLoss} BETWEEN 0 AND 10 AND ${t.pointsLoss} <= ${t.pointsWin}`),
  check("competitions_draw_method", sql`${t.drawMethod} IN ('seeded','raffle')`),
  check("competitions_max_players", sql`${t.maxPlayers} IS NULL OR ${t.maxPlayers} BETWEEN 2 AND 128`),
  check("competitions_cover_url", sql`${t.coverUrl} IS NULL OR ${t.coverUrl} ~ '^(https://[^ ]+|/[^/ ][^ ]*)$'`),
]);

export const competitionEntries = pgTable("competition_entries", {
  id: id(),
  clubId: clubId(),
  competitionId: uuid("competition_id").notNull(),
  membershipId: uuid("membership_id").notNull(),
  seed: smallint("seed"),
  groupLabel: text("group_label"),
  createdAt: createdAt(),
}, (t) => [
  unique("competition_entries_uq").on(t.competitionId, t.membershipId),
  foreignKey({ columns: [t.competitionId, t.clubId], foreignColumns: [competitions.id, competitions.clubId], name: "entries_competition_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "entries_membership_fk" }),
]);

/** A scheduled pairing and its result in one row. Bracket progression via feeds_match_id. */
export const matches = pgTable("matches", {
  id: id(),
  clubId: clubId(),
  competitionId: uuid("competition_id").notNull(),
  round: text("round").notNull(), // "Group A", "Round of 16", "Final"
  roundOrder: smallint("round_order").notNull().default(1),
  slot: smallint("slot").notNull().default(1),
  player1Id: uuid("player1_id"),
  player2Id: uuid("player2_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: matchStatus("status").notNull().default("scheduled"),
  bestOf: smallint("best_of").notNull().default(5),
  winnerId: uuid("winner_id"),
  gamesP1: smallint("games_p1").notNull().default(0),
  gamesP2: smallint("games_p2").notNull().default(0),
  scorerId: uuid("scorer_id"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  feedsMatchId: uuid("feeds_match_id"),
  feedsSlot: smallint("feeds_slot"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique("matches_id_club_uq").on(t.id, t.clubId),
  foreignKey({ columns: [t.competitionId, t.clubId], foreignColumns: [competitions.id, competitions.clubId], name: "matches_competition_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.player1Id, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "matches_p1_fk" }),
  foreignKey({ columns: [t.player2Id, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "matches_p2_fk" }),
  foreignKey({ columns: [t.winnerId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "matches_winner_fk" }),
  foreignKey({ columns: [t.scorerId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "matches_scorer_fk" }),
  index("matches_competition_idx").on(t.competitionId, t.roundOrder, t.slot),
  index("matches_p1_idx").on(t.player1Id),
  index("matches_p2_idx").on(t.player2Id),
  check("matches_distinct_players", sql`${t.player1Id} IS NULL OR ${t.player2Id} IS NULL OR ${t.player1Id} <> ${t.player2Id}`),
  check("matches_winner_is_player", sql`${t.winnerId} IS NULL OR ${t.winnerId} = ${t.player1Id} OR ${t.winnerId} = ${t.player2Id}`),
  check("matches_best_of_odd", sql`${t.bestOf} > 0 AND ${t.bestOf} % 2 = 1`),
  check("matches_completed_has_winner", sql`${t.status} NOT IN ('completed','walkover') OR ${t.winnerId} IS NOT NULL`),
]);

export const games = pgTable("games", {
  id: id(),
  clubId: clubId(),
  matchId: uuid("match_id").notNull(),
  gameNo: smallint("game_no").notNull(),
  p1Points: smallint("p1_points").notNull().default(0),
  p2Points: smallint("p2_points").notNull().default(0),
  /* The umpire ended this game early; whoever led won it. */
  stopped: boolean("stopped").notNull().default(false),
}, (t) => [
  unique("games_id_club_uq").on(t.id, t.clubId),
  unique("games_match_no_uq").on(t.matchId, t.gameNo),
  foreignKey({ columns: [t.matchId, t.clubId], foreignColumns: [matches.id, matches.clubId], name: "games_match_fk" }).onDelete("cascade"),
  check("games_points_nonneg", sql`${t.p1Points} >= 0 AND ${t.p2Points} >= 0`),
  check("games_no_pos", sql`${t.gameNo} > 0`),
]);

/** Point-by-point log (phase 2). Empty until the scorer UI records individual points. */
export const points = pgTable("points", {
  id: id(),
  clubId: clubId(),
  gameId: uuid("game_id").notNull(),
  seq: smallint("seq").notNull(),
  winnerSide: smallint("winner_side").notNull(), // 1 or 2
  serverSide: smallint("server_side"),
  tag: text("tag"), // e.g. service_winner, unforced_error (only when a human recorded it)
}, (t) => [
  unique("points_game_seq_uq").on(t.gameId, t.seq),
  foreignKey({ columns: [t.gameId, t.clubId], foreignColumns: [games.id, games.clubId], name: "points_game_fk" }).onDelete("cascade"),
  check("points_sides", sql`${t.winnerSide} IN (1,2) AND (${t.serverSide} IS NULL OR ${t.serverSide} IN (1,2))`),
]);

export const ratings = pgTable("ratings", {
  id: id(),
  clubId: clubId(),
  membershipId: uuid("membership_id").notNull(),
  scope: ratingScope("scope").notNull(),
  competitionId: uuid("competition_id"),
  rating: integer("rating").notNull().default(1200),
  matchesPlayed: integer("matches_played").notNull().default(0),
  updatedAt: updatedAt(),
}, (t) => [
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "ratings_membership_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.competitionId, t.clubId], foreignColumns: [competitions.id, competitions.clubId], name: "ratings_competition_fk" }).onDelete("cascade"),
  uniqueIndex("ratings_member_scope_uq").on(t.membershipId, t.scope, sql`coalesce(${t.competitionId}, '00000000-0000-0000-0000-000000000000'::uuid)`),
  check("ratings_scope_competition", sql`(${t.scope} = 'competition') = (${t.competitionId} IS NOT NULL)`),
]);

export const ratingEvents = pgTable("rating_events", {
  id: id(),
  clubId: clubId(),
  membershipId: uuid("membership_id").notNull(),
  matchId: uuid("match_id").notNull(),
  scope: ratingScope("scope").notNull().default("club"),
  before: integer("before").notNull(),
  after: integer("after").notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique("rating_events_uq").on(t.membershipId, t.matchId, t.scope),
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "rating_events_membership_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.matchId, t.clubId], foreignColumns: [matches.id, matches.clubId], name: "rating_events_match_fk" }).onDelete("cascade"),
]);

export const statSnapshots = pgTable("stat_snapshots", {
  id: id(),
  clubId: clubId(),
  membershipId: uuid("membership_id").notNull(),
  period: text("period").notNull().default("all"), // "all" or a year like "2026"
  stats: jsonb("stats").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("stat_snapshots_uq").on(t.membershipId, t.period),
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "stat_snapshots_membership_fk" }).onDelete("cascade"),
]);

/** Each club decides whether and when its members get dues reminder emails. Off by default. Offsets are days relative to the due date (negative = before). */
export const reminderSettings = pgTable("reminder_settings", {
  clubId: uuid("club_id").primaryKey().references(() => clubs.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  offsets: integer("offsets").array().notNull().default(sql`ARRAY[-3,0,3,7]`),
  updatedAt: updatedAt(),
});

/**
 * One row per reminder we have sent (or tried to send) for a due. UNIQUE (due, offset) is what makes the job safe to run
 * any number of times and from several places at once: only whoever inserts the row sends the email. Service role only.
 */
export const reminderLog = pgTable("reminder_log", {
  id: id(),
  clubId: clubId(),
  dueId: uuid("due_id").notNull().references(() => dues.id, { onDelete: "cascade" }),
  offsetDays: smallint("offset_days").notNull(),
  userId: text("user_id"),
  email: text("email"),
  status: text("status").notNull().default("sending"), // sending | sent | failed
  attempts: smallint("attempts").notNull().default(1),
  error: text("error"),
  createdAt: createdAt(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => [
  unique("reminder_log_due_offset_uq").on(t.dueId, t.offsetDays),
  index("reminder_log_club_idx").on(t.clubId, t.createdAt),
  check("reminder_log_status", sql`${t.status} IN ('sending','sent','failed')`),
]);

/** When a player says they are at the court. No coordinates are stored, only the time. One open row per member. */
export const arrivals = pgTable("arrivals", {
  id: id(),
  clubId: clubId(),
  membershipId: uuid("membership_id").notNull(),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  method: text("method").notNull().default("manual"),
  /* Set by the service role when other players were alerted; stops repeat alerts within two hours. */
  alertedAt: timestamp("alerted_at", { withTimezone: true }),
}, (t) => [
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "arrivals_membership_fk" }).onDelete("cascade"),
  uniqueIndex("arrivals_one_open").on(t.membershipId).where(sql`${t.leftAt} IS NULL`),
  index("arrivals_club_idx").on(t.clubId, t.arrivedAt),
  check("arrivals_method", sql`${t.method} IN ('manual','auto','door')`),
  check("arrivals_left_after", sql`${t.leftAt} IS NULL OR ${t.leftAt} >= ${t.arrivedAt}`),
]);

/** A friendly one-on-one between two members, outside any competition. Rated only when BOTH players agree. */
export const challenges = pgTable("challenges", {
  id: id(),
  clubId: clubId(),
  challengerId: uuid("challenger_id").notNull(),
  opponentId: uuid("opponent_id").notNull(),
  /* proposed -> accepted -> awaiting (one side entered the score) -> confirmed; or declined / cancelled. */
  status: text("status").notNull().default("proposed"),
  proposedFor: timestamp("proposed_for", { withTimezone: true }),
  message: text("message"),
  bestOf: smallint("best_of").notNull().default(3),
  challengerRated: boolean("challenger_rated").notNull().default(false),
  opponentRated: boolean("opponent_rated").notNull().default(false),
  challengerGames: smallint("challenger_games"),
  opponentGames: smallint("opponent_games"),
  enteredBy: uuid("entered_by"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  /* Set once, by the service role, when Elo was applied (idempotent claim). */
  ratedAt: timestamp("rated_at", { withTimezone: true }),
  challengerBefore: integer("challenger_before"),
  challengerAfter: integer("challenger_after"),
  opponentBefore: integer("opponent_before"),
  opponentAfter: integer("opponent_after"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique("challenges_id_club_uq").on(t.id, t.clubId),
  foreignKey({ columns: [t.challengerId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "challenges_challenger_fk" }),
  foreignKey({ columns: [t.opponentId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "challenges_opponent_fk" }),
  index("challenges_challenger_idx").on(t.challengerId),
  index("challenges_opponent_idx").on(t.opponentId),
  check("challenges_distinct", sql`${t.challengerId} <> ${t.opponentId}`),
  check("challenges_status", sql`${t.status} IN ('proposed','accepted','awaiting','confirmed','declined','cancelled')`),
  check("challenges_best_of", sql`${t.bestOf} IN (1,3,5)`),
  check("challenges_message", sql`${t.message} IS NULL OR char_length(${t.message}) <= 140`),
]);

/** What is on at the club: regular playing sessions, one-off events, and closures (holidays, maintenance). */
export const clubEvents = pgTable("club_events", {
  id: id(),
  clubId: clubId(),
  kind: text("kind").notNull(), // play | event | closed
  title: text("title").notNull(),
  note: text("note"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  startTime: text("start_time"), // "HH:MM" local to the club, null = all day
  doorsOpen: text("doors_open"), // "HH:MM", optional, not after the start
  endTime: text("end_time"),
  repeatsWeekly: boolean("repeats_weekly").notNull().default(false),
  until: date("until"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique("club_events_id_club_uq").on(t.id, t.clubId),
  index("club_events_club_idx").on(t.clubId, t.startsOn),
  check("club_events_doors", sql`${t.doorsOpen} IS NULL OR (${t.doorsOpen} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND ${t.startTime} IS NOT NULL AND ${t.doorsOpen} <= ${t.startTime})`),
  check("club_events_kind", sql`${t.kind} IN ('play','event','closed')`),
  check("club_events_title", sql`char_length(${t.title}) BETWEEN 1 AND 80`),
  check("club_events_note", sql`${t.note} IS NULL OR char_length(${t.note}) <= 280`),
  check("club_events_range", sql`${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`),
  check("club_events_times", sql`(${t.startTime} IS NULL OR ${t.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND (${t.endTime} IS NULL OR ${t.endTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND (${t.endTime} IS NULL OR ${t.startTime} IS NOT NULL) AND (${t.endTime} IS NULL OR ${t.endTime} > ${t.startTime})`),
  check("club_events_repeat", sql`NOT ${t.repeatsWeekly} OR (${t.kind} = 'play' AND ${t.endsOn} IS NULL)`),
  check("club_events_until", sql`${t.until} IS NULL OR (${t.repeatsWeekly} AND ${t.until} >= ${t.startsOn})`),
]);

/** What the club owns: tables, bats, balls, nets. Looked after by the Facilities admin. */
export const facilityItems = pgTable("facility_items", {
  id: id(),
  clubId: clubId(),
  kind: text("kind").notNull(), // table | bat | ball | net | other
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  minQuantity: integer("min_quantity"),
  status: text("status").notNull().default("ok"), // ok | needs_attention | out
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique("facility_items_id_club_uq").on(t.id, t.clubId),
  index("facility_items_club_idx").on(t.clubId, t.kind),
  check("facility_items_kind", sql`${t.kind} IN ('table','bat','ball','net','other')`),
  check("facility_items_name", sql`char_length(${t.name}) BETWEEN 1 AND 80`),
  check("facility_items_quantity", sql`${t.quantity} BETWEEN 0 AND 100000 AND (${t.minQuantity} IS NULL OR ${t.minQuantity} BETWEEN 0 AND 100000)`),
  check("facility_items_status", sql`${t.status} IN ('ok','needs_attention','out')`),
  check("facility_items_note", sql`${t.note} IS NULL OR char_length(${t.note}) <= 280`),
]);

/** Append-only history of upkeep and stock changes. */
export const facilityLog = pgTable("facility_log", {
  id: id(),
  clubId: clubId(),
  itemId: uuid("item_id").notNull(),
  kind: text("kind").notNull(), // maintenance | stock | note
  note: text("note"),
  delta: integer("delta"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
}, (t) => [
  foreignKey({ columns: [t.itemId, t.clubId], foreignColumns: [facilityItems.id, facilityItems.clubId], name: "facility_log_item_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.createdBy, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "facility_log_by_fk" }),
  index("facility_log_item_idx").on(t.itemId, t.createdAt),
  check("facility_log_kind", sql`${t.kind} IN ('maintenance','stock','note')`),
  check("facility_log_note", sql`${t.note} IS NULL OR char_length(${t.note}) <= 280`),
]);

/** A season groups competitions; its table adds up the points from all of them. */
export const seasons = pgTable("seasons", {
  id: id(),
  clubId: clubId(),
  name: text("name").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique("seasons_id_club_uq").on(t.id, t.clubId),
  check("seasons_name", sql`char_length(${t.name}) BETWEEN 1 AND 60`),
  check("seasons_range", sql`${t.endsOn} >= ${t.startsOn}`),
]);

/** Podium places, written by the server when a competition finishes. Third place can be shared (two losing semi-finalists). */
export const competitionAwards = pgTable("competition_awards", {
  id: id(),
  clubId: clubId(),
  competitionId: uuid("competition_id").notNull(),
  membershipId: uuid("membership_id").notNull(),
  place: smallint("place").notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique("competition_awards_uq").on(t.competitionId, t.membershipId),
  foreignKey({ columns: [t.competitionId, t.clubId], foreignColumns: [competitions.id, competitions.clubId], name: "awards_competition_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "awards_membership_fk" }),
  check("competition_awards_place", sql`${t.place} BETWEEN 1 AND 3`),
]);

/** People queued for a full competition. Written only by the database functions; the oldest is promoted when a spot opens. */
export const competitionWaitlist = pgTable("competition_waitlist", {
  id: id(),
  clubId: clubId(),
  competitionId: uuid("competition_id").notNull(),
  membershipId: uuid("membership_id").notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique("competition_waitlist_uq").on(t.competitionId, t.membershipId),
  foreignKey({ columns: [t.competitionId, t.clubId], foreignColumns: [competitions.id, competitions.clubId], name: "waitlist_competition_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "waitlist_membership_fk" }).onDelete("cascade"),
  index("competition_waitlist_idx").on(t.competitionId, t.createdAt),
]);

/** "I'm coming": a member says they will be at a session or event on a given day. Private: players see their own, admins see who is coming today. */
export const eventRsvps = pgTable("event_rsvps", {
  id: id(),
  clubId: clubId(),
  eventId: uuid("event_id").notNull(),
  onDate: date("on_date").notNull(),
  membershipId: uuid("membership_id").notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique("event_rsvps_uq").on(t.eventId, t.onDate, t.membershipId),
  foreignKey({ columns: [t.eventId, t.clubId], foreignColumns: [clubEvents.id, clubEvents.clubId], name: "rsvps_event_fk" }).onDelete("cascade"),
  foreignKey({ columns: [t.membershipId, t.clubId], foreignColumns: [memberships.id, memberships.clubId], name: "rsvps_membership_fk" }).onDelete("cascade"),
  index("event_rsvps_day_idx").on(t.clubId, t.onDate),
]);
