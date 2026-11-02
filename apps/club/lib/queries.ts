import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { competitionEntries, competitions, dues, games, matches, memberships, payments, plans, playerProfiles, ratings, users, type Tx } from "@rallix/db";
import { computeRecord, headToHead, type PlayedMatch } from "@rallix/stats";

export type MemberView = {
  id: string; userId: string; name: string; photo: string | null; level: "junior" | "intermediate" | "senior";
  country: string; heightCm: number | null; dob: string | null; rating: number; rank: number; roles: string[]; joinedAt: Date;
};

const ratingExpr = sql<number>`coalesce(${ratings.rating}, 1200)`;

/** Club roster ordered by club rating, with rank positions. */
export async function listMembers(tx: Tx, clubId: string): Promise<MemberView[]> {
  const rows = await tx.select({
    id: memberships.id, userId: memberships.userId, name: users.name, photo: playerProfiles.photoUrl, level: playerProfiles.level,
    country: playerProfiles.country, heightCm: playerProfiles.heightCm, dob: playerProfiles.dateOfBirth, rating: ratingExpr, roles: memberships.roles, joinedAt: memberships.joinedAt,
  }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id))
    .leftJoin(ratings, and(eq(ratings.membershipId, memberships.id), eq(ratings.scope, "club")))
    .where(and(eq(memberships.clubId, clubId), eq(memberships.status, "active"), sql`'player' = ANY(${memberships.roles})`))
    .orderBy(desc(ratingExpr), asc(users.name));
  return rows.map((r, i) => ({ ...r, level: r.level ?? "junior", country: r.country ?? "NGR", heightCm: r.heightCm ?? null, dob: r.dob ?? null, rating: Number(r.rating), rank: i + 1 }));
}

export const ageOf = (dob: string | null) => (dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null);

export type MatchView = {
  id: string; competitionId: string; competitionName: string; round: string; status: string; bestOf: number;
  scheduledAt: Date | null; confirmedAt: Date | null;
  p1: { id: string; name: string; photo: string | null } | null; p2: { id: string; name: string; photo: string | null } | null;
  winnerId: string | null; gamesP1: number; gamesP2: number; games: Array<{ no: number; p1: number; p2: number }>;
};

/** Matches with player names and game scores. Optional filters keep it cheap. */
export async function listMatches(tx: Tx, clubId: string, f: { competitionId?: string; memberId?: string; matchId?: string } = {}): Promise<MatchView[]> {
  const cond = [eq(matches.clubId, clubId)];
  if (f.competitionId) cond.push(eq(matches.competitionId, f.competitionId));
  if (f.matchId) cond.push(eq(matches.id, f.matchId));
  if (f.memberId) cond.push(sql`(${matches.player1Id} = ${f.memberId} OR ${matches.player2Id} = ${f.memberId})`);
  const rows = await tx.select().from(matches).innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(...cond)).orderBy(asc(matches.roundOrder), asc(matches.slot), asc(matches.createdAt));
  if (!rows.length) return [];
  const memberIds = [...new Set(rows.flatMap((r) => [r.matches.player1Id, r.matches.player2Id]).filter((x): x is string => !!x))];
  const people = memberIds.length ? await tx.select({ id: memberships.id, name: users.name, photo: playerProfiles.photoUrl })
    .from(memberships).innerJoin(users, eq(users.id, memberships.userId)).leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id))
    .where(inArray(memberships.id, memberIds)) : [];
  const byId = new Map(people.map((p) => [p.id, { id: p.id, name: p.name, photo: p.photo ?? null }]));
  const gs = await tx.select().from(games).where(inArray(games.matchId, rows.map((r) => r.matches.id))).orderBy(asc(games.gameNo));
  return rows.map(({ matches: m, competitions: c }) => ({
    id: m.id, competitionId: m.competitionId, competitionName: c.name, round: m.round, status: m.status, bestOf: m.bestOf,
    scheduledAt: m.scheduledAt, confirmedAt: m.confirmedAt,
    p1: m.player1Id ? byId.get(m.player1Id) ?? null : null, p2: m.player2Id ? byId.get(m.player2Id) ?? null : null,
    winnerId: m.winnerId, gamesP1: m.gamesP1, gamesP2: m.gamesP2,
    games: gs.filter((g) => g.matchId === m.id).map((g) => ({ no: g.gameNo, p1: g.p1Points, p2: g.p2Points })),
  }));
}

/** Confirmed results only, shaped for the stats engine. */
export async function playedMatches(tx: Tx, clubId: string, memberId?: string): Promise<PlayedMatch[]> {
  const ms = (await listMatches(tx, clubId, { memberId })).filter((m) => (m.status === "completed" || m.status === "walkover") && m.winnerId && m.p1 && m.p2 && m.confirmedAt);
  return ms.map((m) => ({ id: m.id, player1Id: m.p1!.id, player2Id: m.p2!.id, winnerId: m.winnerId!, playedAt: m.confirmedAt!, games: m.games.map((g) => ({ p1: g.p1, p2: g.p2 })) }));
}

export async function memberStats(tx: Tx, clubId: string, memberId: string) {
  const played = await playedMatches(tx, clubId, memberId);
  return { record: computeRecord(memberId, played), h2h: headToHead(memberId, played) };
}

export async function ratingHistory(tx: Tx, memberId: string) {
  const rows = await tx.execute(sql`select "after", created_at from rating_events where membership_id = ${memberId} order by created_at`);
  return rows.rows as Array<{ after: number; created_at: Date }>;
}

export async function listCompetitions(tx: Tx, clubId: string, memberId?: string) {
  const rows = await tx.select().from(competitions).where(eq(competitions.clubId, clubId)).orderBy(desc(competitions.createdAt));
  if (!memberId) return rows;
  const mine = await tx.select({ id: competitionEntries.competitionId }).from(competitionEntries).where(eq(competitionEntries.membershipId, memberId));
  const ids = new Set(mine.map((m) => m.id));
  return rows.filter((r) => ids.has(r.id));
}

export async function getCompetition(tx: Tx, id: string) {
  const [c] = await tx.select().from(competitions).where(eq(competitions.id, id)).limit(1);
  return c ?? null;
}

export async function listPlans(tx: Tx, clubId: string) {
  return tx.select().from(plans).where(eq(plans.clubId, clubId)).orderBy(asc(plans.period), asc(plans.priceKobo));
}

export async function listDues(tx: Tx, clubId: string, memberId?: string) {
  const cond = [eq(dues.clubId, clubId)];
  if (memberId) cond.push(eq(dues.membershipId, memberId));
  return tx.select({ id: dues.id, membershipId: dues.membershipId, amountKobo: dues.amountKobo, periodLabel: dues.periodLabel, dueDate: dues.dueDate, status: dues.status, name: users.name, photo: playerProfiles.photoUrl, plan: plans.name })
    .from(dues).innerJoin(memberships, eq(memberships.id, dues.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, dues.membershipId)).innerJoin(plans, eq(plans.id, dues.planId))
    .where(and(...cond)).orderBy(desc(dues.dueDate), asc(users.name));
}

export async function listPayments(tx: Tx, clubId: string, memberId: string) {
  return tx.select().from(payments).where(and(eq(payments.clubId, clubId), eq(payments.membershipId, memberId))).orderBy(desc(payments.createdAt));
}

/** Money taken in a period, bucketed into 4 equal slices for the bar chart. */
export async function revenue(tx: Tx, clubId: string, period: "Today" | "Week" | "Month" | "Year") {
  const days = { Today: 1, Week: 7, Month: 30, Year: 365 }[period];
  const since = new Date(Date.now() - days * 86400000);
  const rows = await tx.select({ amount: payments.amountKobo, at: payments.paidAt }).from(payments)
    .where(and(eq(payments.clubId, clubId), eq(payments.status, "paid"), gte(payments.paidAt, since)));
  const span = days * 86400000 / 4;
  const bars = [0, 0, 0, 0];
  let total = 0;
  for (const r of rows) {
    total += r.amount;
    const idx = Math.min(3, Math.floor((Date.now() - r.at!.getTime()) / span));
    bars[3 - idx]! += r.amount;
  }
  return { total, bars };
}

export async function globalLeaderboard(tx: Tx, limit = 20) {
  const r = await tx.execute(sql`select user_id, name, rating from app.global_leaderboard order by rating desc, name limit ${limit}`);
  return r.rows as Array<{ user_id: string; name: string; rating: number }>;
}

export const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

/** "28 Nov 2026" from a YYYY-MM-DD string or Date. */
export const fmtDate = (d: string | Date) => (typeof d === "string" ? new Date(`${d}T12:00:00`) : d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

/** Registered players per competition (admin home cards). */
export async function entryCounts(tx: Tx, clubId: string): Promise<Record<string, number>> {
  const rows = await tx.select({ id: competitionEntries.competitionId, n: sql<number>`count(*)` }).from(competitionEntries)
    .where(eq(competitionEntries.clubId, clubId)).groupBy(competitionEntries.competitionId);
  return Object.fromEntries(rows.map((r) => [r.id, Number(r.n)]));
}

/** Latest paid payments with the payer's name (admin activity feed). */
export async function recentPayments(tx: Tx, clubId: string, limit = 8) {
  return tx.select({ id: payments.id, amountKobo: payments.amountKobo, paidAt: payments.paidAt, name: users.name })
    .from(payments).innerJoin(memberships, eq(memberships.id, payments.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(payments.clubId, clubId), eq(payments.status, "paid"))).orderBy(desc(payments.paidAt)).limit(limit);
}

export type CompetitionCard = typeof competitions.$inferSelect & { entries: number; registered: boolean };

/** Every competition this player may see (row-level security hides hidden drafts), with the sign-up count and whether they are in it. */
export async function listCompetitionsForPlayer(tx: Tx, clubId: string, me: string): Promise<CompetitionCard[]> {
  const rows = await tx.select().from(competitions).where(eq(competitions.clubId, clubId)).orderBy(desc(competitions.createdAt));
  const counts = await entryCounts(tx, clubId);
  const mine = await tx.select({ id: competitionEntries.competitionId }).from(competitionEntries).where(eq(competitionEntries.membershipId, me));
  const inIt = new Set(mine.map((m) => m.id));
  return rows.map((c) => ({ ...c, entries: counts[c.id] ?? 0, registered: inIt.has(c.id) }));
}

export type Participant = { id: string; name: string; photo: string | null };

/** Everything the competition preview page needs in one place. Null when the competition does not exist or is hidden from this player. */
export async function getCompetitionPreview(tx: Tx, clubId: string, id: string, me: string) {
  const c = await getCompetition(tx, id);
  if (!c) return null;
  const people = await tx.select({ id: memberships.id, name: users.name, photo: playerProfiles.photoUrl })
    .from(competitionEntries)
    .innerJoin(memberships, eq(memberships.id, competitionEntries.membershipId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id))
    .where(eq(competitionEntries.competitionId, id))
    .orderBy(asc(competitionEntries.createdAt));
  const [profile] = await tx.select({ level: playerProfiles.level }).from(playerProfiles).where(eq(playerProfiles.membershipId, me)).limit(1);
  return { c, participants: people as Participant[], registered: people.some((p) => p.id === me), myLevel: profile?.level ?? null };
}
