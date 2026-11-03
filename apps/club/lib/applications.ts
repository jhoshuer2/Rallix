import { and, asc, eq, sql } from "drizzle-orm";
import { clubs, membershipApplications, clubPages, withTenant, type Tx } from "@rallix/db";
import { appDb } from "./db";

export type PendingApplication = { id: string; name: string; level: string; message: string | null; createdAt: Date };

/** Applications waiting for a decision in this club (row-level security shows them to its admins only). */
export async function listPendingApplications(tx: Tx, clubId: string): Promise<PendingApplication[]> {
  return tx.select({ id: membershipApplications.id, name: membershipApplications.name, level: membershipApplications.level, message: membershipApplications.message, createdAt: membershipApplications.createdAt })
    .from(membershipApplications).where(and(eq(membershipApplications.clubId, clubId), eq(membershipApplications.status, "pending"))).orderBy(asc(membershipApplications.createdAt));
}

export async function pendingApplicationCount(tx: Tx, clubId: string): Promise<number> {
  const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(membershipApplications).where(and(eq(membershipApplications.clubId, clubId), eq(membershipApplications.status, "pending")));
  return r?.n ?? 0;
}

export type MyApplication = { id: string; clubId: string; clubName: string; status: string; createdAt: Date };

/** The signed-in person's own pending applications, across clubs. Runs as that user, with no club selected. */
export async function myPendingApplications(userId: string): Promise<MyApplication[]> {
  return withTenant(appDb(), { userId }, (tx) =>
    tx.select({ id: membershipApplications.id, clubId: membershipApplications.clubId, clubName: clubs.name, status: membershipApplications.status, createdAt: membershipApplications.createdAt })
      .from(membershipApplications).innerJoin(clubs, eq(clubs.id, membershipApplications.clubId))
      .where(and(eq(membershipApplications.userId, userId), eq(membershipApplications.status, "pending"))).orderBy(asc(membershipApplications.createdAt)));
}

/** Whether this club has written anything on its page yet (for the setup checklist). */
export async function hasClubPageContent(tx: Tx, clubId: string): Promise<boolean> {
  const [p] = await tx.select().from(clubPages).where(eq(clubPages.clubId, clubId));
  return !!p && [p.about, p.schedule, p.dressCode, p.equipment, p.rules, p.contact].some((x) => !!x && x.trim().length > 0);
}
