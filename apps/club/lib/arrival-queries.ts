import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { arrivals, clubs, memberships, playerProfiles, users, type Tx } from "@rallix/db";

export const HERE_HOURS = 6;

export type Here = { id: string; membershipId: string; name: string; photo: string | null; since: Date };

/** Who is at the court right now: open arrivals from the last six hours. Everyone in the club may read this (row-level security). */
export async function listHere(tx: Tx, clubId: string): Promise<Here[]> {
  const rows = await tx.select({ id: arrivals.id, membershipId: arrivals.membershipId, name: users.name, photo: playerProfiles.photoUrl, since: arrivals.arrivedAt })
    .from(arrivals)
    .innerJoin(memberships, eq(memberships.id, arrivals.membershipId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, arrivals.membershipId))
    .where(and(eq(arrivals.clubId, clubId), isNull(arrivals.leftAt), gt(arrivals.arrivedAt, sql`now() - interval '${sql.raw(String(HERE_HOURS))} hours'`)))
    .orderBy(desc(arrivals.arrivedAt));
  return rows;
}

export type Venue = { label: string | null; lat: number; lng: number; radiusM: number };
export async function getVenue(tx: Tx, clubId: string): Promise<Venue | null> {
  const [c] = await tx.select({ label: clubs.venueLabel, lat: clubs.venueLat, lng: clubs.venueLng, radiusM: clubs.venueRadiusM }).from(clubs).where(eq(clubs.id, clubId)).limit(1);
  return c && c.lat !== null && c.lng !== null ? { label: c.label, lat: c.lat, lng: c.lng, radiusM: c.radiusM } : null;
}

export type ArrivalSettings = { share: boolean; notify: boolean; auto: boolean };
export async function getArrivalSettings(tx: Tx, membershipId: string): Promise<ArrivalSettings> {
  const [p] = await tx.select({ share: playerProfiles.shareArrival, notify: playerProfiles.notifyArrivals, auto: playerProfiles.autoArrival }).from(playerProfiles).where(eq(playerProfiles.membershipId, membershipId)).limit(1);
  return p ?? { share: false, notify: false, auto: false };
}
