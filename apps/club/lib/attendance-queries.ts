import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { arrivals, memberships, playerProfiles, users, type Tx } from "@rallix/db";
import type { Visit } from "@rallix/stats";
import { HERE_HOURS } from "./arrival-queries";

export type Visitor = { membershipId: string; name: string; photo: string | null; since: Date; method: string };

/** Everyone who is here now (checked in within the last 6 hours and not checked out), with how they checked in. */
export async function listHereNow(tx: Tx, clubId: string): Promise<Visitor[]> {
  return tx.select({ membershipId: arrivals.membershipId, name: users.name, photo: playerProfiles.photoUrl, since: arrivals.arrivedAt, method: arrivals.method })
    .from(arrivals)
    .innerJoin(memberships, eq(memberships.id, arrivals.membershipId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, arrivals.membershipId))
    .where(and(eq(arrivals.clubId, clubId), isNull(arrivals.leftAt), gt(arrivals.arrivedAt, sql`now() - interval '${sql.raw(String(HERE_HOURS))} hours'`)))
    .orderBy(desc(arrivals.arrivedAt));
}

/** One row per arrival in the last `days` days, dated in the club's timezone (Lagos). */
export async function listVisits(tx: Tx, clubId: string, days = 14): Promise<Visit[]> {
  const rows = await tx.select({ memberId: arrivals.membershipId, date: sql<string>`to_char((${arrivals.arrivedAt} at time zone 'Africa/Lagos')::date, 'YYYY-MM-DD')` })
    .from(arrivals).where(and(eq(arrivals.clubId, clubId), gt(arrivals.arrivedAt, sql`now() - interval '${sql.raw(String(days + 1))} days'`)));
  return rows;
}

/** Members who can be let in (active players), for the picker. */
export async function listPeople(tx: Tx, clubId: string): Promise<Array<{ id: string; name: string; photo: string | null }>> {
  const rows = await tx.select({ id: memberships.id, name: users.name, photo: playerProfiles.photoUrl }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId)).leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id))
    .where(and(eq(memberships.clubId, clubId), eq(memberships.status, "active"), sql`'player' = ANY(${memberships.roles})`)).orderBy(users.name);
  return rows.map((r) => ({ ...r, photo: r.photo ?? null }));
}
