import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { competitionAwards, competitions, memberships, playerProfiles, seasons, users, type Tx } from "@rallix/db";
import { seasonTable, standingsByTable, type Place, type PointsRules, type StandingMatch } from "@rallix/stats";
import { listMatches, type MatchView } from "./queries";

const decided = (m: MatchView) => (m.status === "completed" || m.status === "walkover") && !!m.winnerId && !!m.p1 && !!m.p2;

/** Shape matches for the league-table rules. Group stage matches are tabled per group; everything else is one table. */
export function toStandingMatches(ms: MatchView[], format: string): StandingMatch[] {
  return ms.map((m) => ({
    table: format === "group_stage" ? m.round : "", p1: m.p1?.id ?? null, p2: m.p2?.id ?? null, winner: m.winnerId, done: decided(m),
    g1: m.gamesP1, g2: m.gamesP2, pts1: m.games.reduce((a, g) => a + g.p1, 0), pts2: m.games.reduce((a, g) => a + g.p2, 0),
  }));
}
export const rulesOf = (c: { pointsWin: number; pointsLoss: number }): PointsRules => ({ win: c.pointsWin, loss: c.pointsLoss });

export type Person = { id: string; name: string; photo: string | null };
export type TableView = { table: string; rows: Array<{ rank: number; person: Person; played: number; won: number; lost: number; points: number }> };

export function tablesFor(ms: MatchView[], format: string, rules: PointsRules, people: Map<string, Person>): TableView[] {
  if (format === "knockout") return [];
  return standingsByTable(toStandingMatches(ms, format), rules)
    .map((t) => ({ table: t.table, rows: t.rows.filter((r) => r.played > 0).map((r) => ({ rank: r.rank, person: people.get(r.id) ?? { id: r.id, name: "Former member", photo: null }, played: r.played, won: r.won, lost: r.lost, points: r.points })) }))
    .filter((t) => t.rows.length > 0);
}

export const peopleOf = (ms: MatchView[]) => new Map(ms.flatMap((m) => [m.p1, m.p2]).filter((p): p is Person => !!p).map((p) => [p.id, p]));

export type SeasonView = { id: string; name: string; startsOn: string; endsOn: string };
export async function listSeasons(tx: Tx, clubId: string): Promise<SeasonView[]> {
  return tx.select({ id: seasons.id, name: seasons.name, startsOn: seasons.startsOn, endsOn: seasons.endsOn }).from(seasons).where(eq(seasons.clubId, clubId)).orderBy(desc(seasons.startsOn));
}
/** The season running today, if any (the latest to start wins). */
export async function currentSeason(tx: Tx, clubId: string, today: string): Promise<SeasonView | null> {
  const [s] = await tx.select({ id: seasons.id, name: seasons.name, startsOn: seasons.startsOn, endsOn: seasons.endsOn }).from(seasons)
    .where(and(eq(seasons.clubId, clubId), lte(seasons.startsOn, today), gte(seasons.endsOn, today))).orderBy(desc(seasons.startsOn)).limit(1);
  return s ?? null;
}

/** A season's table: every decided match of its competitions, each scored by that competition's own rules. */
export async function seasonStandings(tx: Tx, clubId: string, seasonId: string): Promise<Array<{ rank: number; person: Person; played: number; won: number; points: number }>> {
  const comps = await tx.select({ id: competitions.id, format: competitions.format, pointsWin: competitions.pointsWin, pointsLoss: competitions.pointsLoss }).from(competitions)
    .where(and(eq(competitions.clubId, clubId), eq(competitions.seasonId, seasonId)));
  if (!comps.length) return [];
  const all = await listMatches(tx, clubId);
  const rows = seasonTable(comps.map((c) => ({ rules: rulesOf(c), matches: toStandingMatches(all.filter((m) => m.competitionId === c.id), "season") })));
  const people = peopleOf(all);
  return rows.filter((r) => r.played > 0).map((r) => ({ rank: r.rank, person: people.get(r.id) ?? { id: r.id, name: "Former member", photo: null }, played: r.played, won: r.won, points: r.points }));
}

export type AwardView = { place: Place; person: Person };
export async function listAwards(tx: Tx, competitionId: string): Promise<AwardView[]> {
  const rows = await tx.select({ id: memberships.id, name: users.name, photo: playerProfiles.photoUrl, place: competitionAwards.place }).from(competitionAwards)
    .innerJoin(memberships, eq(memberships.id, competitionAwards.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id)).where(eq(competitionAwards.competitionId, competitionId)).orderBy(asc(competitionAwards.place), asc(users.name));
  return rows.map((r) => ({ place: r.place as Place, person: { id: r.id, name: r.name, photo: r.photo ?? null } }));
}
/** A player's own podium places across the club (hidden when none). */
export async function myAwards(tx: Tx, memberId: string): Promise<Array<{ place: Place; competition: string; competitionId: string }>> {
  const rows = await tx.select({ place: competitionAwards.place, competition: competitions.name, competitionId: competitions.id }).from(competitionAwards)
    .innerJoin(competitions, eq(competitions.id, competitionAwards.competitionId)).where(eq(competitionAwards.membershipId, memberId)).orderBy(asc(competitionAwards.place));
  return rows.map((r) => ({ ...r, place: r.place as Place }));
}
