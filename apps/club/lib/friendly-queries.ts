import { and, desc, eq, or, sql } from "drizzle-orm";
import { challenges, memberships, playerProfiles, users, type Tx } from "@rallix/db";
import type { ChallengeLike, ChallengeStatus } from "@rallix/stats";

export type Person = { id: string; name: string; photo: string | null };
export type ChallengeView = ChallengeLike & {
  id: string; proposedFor: Date | null; message: string | null; createdAt: Date; confirmedAt: Date | null; ratedAt: Date | null;
  challenger: Person; opponent: Person;
  challengerBefore: number | null; challengerAfter: number | null; opponentBefore: number | null; opponentAfter: number | null;
};

/** My challenges in the active club (row-level security already limits this to the two players). Newest first. */
export async function listMyChallenges(tx: Tx, clubId: string, me: string, limit = 60): Promise<ChallengeView[]> {
  const rows = await tx.select().from(challenges)
    .where(and(eq(challenges.clubId, clubId), or(eq(challenges.challengerId, me), eq(challenges.opponentId, me))))
    .orderBy(desc(challenges.createdAt)).limit(limit);
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.challengerId, r.opponentId]))];
  const people = await tx.select({ id: memberships.id, name: users.name, photo: playerProfiles.photoUrl }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id))
    .where(and(eq(memberships.clubId, clubId), sql`${memberships.id} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`));
  const by = new Map(people.map((p) => [p.id, { id: p.id, name: p.name, photo: p.photo ?? null } as Person]));
  const unknown = (id: string): Person => ({ id, name: "A player", photo: null });
  return rows.map((r) => ({
    id: r.id, status: r.status as ChallengeStatus, challengerId: r.challengerId, opponentId: r.opponentId, bestOf: r.bestOf,
    challengerRated: r.challengerRated, opponentRated: r.opponentRated, challengerGames: r.challengerGames, opponentGames: r.opponentGames, enteredBy: r.enteredBy,
    proposedFor: r.proposedFor, message: r.message, createdAt: r.createdAt, confirmedAt: r.confirmedAt, ratedAt: r.ratedAt,
    challengerBefore: r.challengerBefore, challengerAfter: r.challengerAfter, opponentBefore: r.opponentBefore, opponentAfter: r.opponentAfter,
    challenger: by.get(r.challengerId) ?? unknown(r.challengerId), opponent: by.get(r.opponentId) ?? unknown(r.opponentId),
  }));
}

/** How many challenges are waiting for me (an answer or a confirmation): drives the badge and the "needs you" list. */
export const needsMe = (list: ChallengeView[], me: string) =>
  list.filter((c) => (c.status === "proposed" && c.opponentId === me) || (c.status === "awaiting" && c.enteredBy !== me));
