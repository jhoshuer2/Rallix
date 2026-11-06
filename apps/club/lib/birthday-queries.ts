import { and, eq, sql } from "drizzle-orm";
import { clubs, memberships, playerProfiles, users, type Tx } from "@rallix/db";
import type { CelebrationClub, CelebrationMember } from "@rallix/stats";

/**
 * Everyone who can be celebrated: every active member (players and admins). A birthday is passed on only when that person
 * left "Show my birthday" on; month and day are all the strip ever shows. Non-players get a birthday only.
 */
export async function listCelebrants(tx: Tx, clubId: string): Promise<CelebrationMember[]> {
  const rows = await tx.select({
    id: memberships.id, name: users.name, photo: playerProfiles.photoUrl, dob: playerProfiles.dateOfBirth, show: playerProfiles.showBirthday,
    joinedAt: memberships.joinedAt, player: sql<boolean>`'player' = ANY(${memberships.roles})`,
  }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id))
    .where(and(eq(memberships.clubId, clubId), eq(memberships.status, "active")));
  return rows.map((r) => ({ id: r.id, name: r.name, photo: r.photo, dob: r.show === false ? null : r.dob, joinedAt: r.joinedAt, birthdayOnly: !r.player }));
}

/** The club's own anniversary comes from the day it was created. */
export async function clubForCelebration(tx: Tx, clubId: string): Promise<CelebrationClub | null> {
  const [c] = await tx.select({ name: clubs.name, logo: clubs.logoUrl, createdAt: clubs.createdAt }).from(clubs).where(eq(clubs.id, clubId)).limit(1);
  return c ?? null;
}

/** The signed-in person's own birthday settings, for the form. */
export async function myBirthday(tx: Tx, membershipId: string): Promise<{ month: number | null; day: number | null; show: boolean; hasYear: boolean }> {
  const [p] = await tx.select({ dob: playerProfiles.dateOfBirth, show: playerProfiles.showBirthday }).from(playerProfiles).where(eq(playerProfiles.membershipId, membershipId)).limit(1);
  const dob = p?.dob ?? null;
  return { month: dob ? Number(dob.slice(5, 7)) : null, day: dob ? Number(dob.slice(8, 10)) : null, show: p?.show ?? true, hasYear: !!dob && Number(dob.slice(0, 4)) > 1904 };
}
