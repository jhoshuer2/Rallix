import { and, eq, gte, lte } from "drizzle-orm";
import { eventRsvps, memberships, playerProfiles, users, type Tx } from "@rallix/db";
import type { RsvpRow } from "@rallix/stats";

/** The days the signed-in member said they are coming, as "eventId:YYYY-MM-DD" keys. Row-level security means this is only ever your own. */
export async function myComing(tx: Tx, memberId: string, from: string, to: string): Promise<Set<string>> {
  const rows = await tx.select({ e: eventRsvps.eventId, d: eventRsvps.onDate }).from(eventRsvps).where(and(eq(eventRsvps.membershipId, memberId), gte(eventRsvps.onDate, from), lte(eventRsvps.onDate, to)));
  return new Set(rows.map((r) => `${r.e}:${r.d}`));
}

/** Everyone's RSVPs for one day (the Members admin only; for anyone else row-level security returns just their own). */
export async function comingOn(tx: Tx, clubId: string, date: string): Promise<Array<RsvpRow & { name: string; photo: string | null }>> {
  const rows = await tx.select({ eventId: eventRsvps.eventId, memberId: eventRsvps.membershipId, name: users.name, photo: playerProfiles.photoUrl }).from(eventRsvps)
    .innerJoin(memberships, eq(memberships.id, eventRsvps.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id)).where(and(eq(eventRsvps.clubId, clubId), eq(eventRsvps.onDate, date)));
  return rows.map((r) => ({ ...r, photo: r.photo ?? null }));
}
