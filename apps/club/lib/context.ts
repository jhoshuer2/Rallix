import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { clubs, memberships, withTenant, type Tx } from "@rallix/db";
import { auth } from "./auth";
import { appDb } from "./db";
import { ALL_PERMISSIONS, type Permission } from "./permissions";
import { myPendingApplications } from "./applications";

export type Role = "admin" | "scorer" | "coach" | "player";
export type MyClub = { clubId: string; membershipId: string; name: string; slug: string; logoUrl: string | null; coverUrl: string | null; roles: Role[]; permissions: Permission[]; isOwner: boolean };
export type BlockedClub = { name: string; status: "suspended" | "closed" };
export type Ctx = { user: { id: string; name: string; email: string; image: string | null }; needsName: boolean; clubs: MyClub[]; club: MyClub | null; blocked: BlockedClub[] };

export const CLUB_COOKIE = "rallix_club";

export const getSessionUser = cache(async () => {
  const s = await auth().api.getSession({ headers: await headers() });
  return s?.user ?? null;
});

/** Signed-in user, their clubs and the active club (from the cookie, else the first). */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const { rows, blocked } = await withTenant(appDb(), { userId: user.id }, async (tx) => ({
    rows: await tx.select({ clubId: clubs.id, membershipId: memberships.id, name: clubs.name, slug: clubs.slug, logoUrl: clubs.logoUrl, coverUrl: clubs.coverUrl, roles: memberships.roles, permissions: memberships.permissions, ownerId: clubs.ownerId })
      .from(memberships).innerJoin(clubs, eq(clubs.id, memberships.clubId))
      .where(and(eq(memberships.userId, user.id), eq(memberships.status, "active")))
      .orderBy(clubs.name),
    // Clubs the user belongs to that the platform has suspended or closed (hidden from every other query).
    blocked: (await tx.execute(sql`select name, status from app.blocked_clubs()`)).rows as BlockedClub[],
  }));
  const wanted = (await cookies()).get(CLUB_COOKIE)?.value;
  const mine: MyClub[] = rows.map(({ ownerId, permissions, ...c }) => ({ ...c, isOwner: ownerId === user.id, permissions: (ownerId === user.id ? ALL_PERMISSIONS : permissions.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p))) }));
  const club = mine.find((c) => c.clubId === wanted) ?? mine[0] ?? null;
  const named = user.name.trim().length > 0 && user.name !== "New player";
  // A brand-new email account has no name yet. Show the part of the email before @ until they give one.
  return { user: { id: user.id, name: named ? user.name : user.email.split("@")[0]!, email: user.email, image: user.image ?? null }, needsName: !named, clubs: mine, club, blocked };
});

/** Page guard: signed in and belongs to a club. New users are sent to create or join one. */
export async function requireClub(): Promise<Ctx & { club: MyClub }> {
  const ctx = await getCtx();
  if (!ctx) redirect("/sign-in");
  if (!ctx.club) {
    if (ctx.blocked.length) redirect("/suspended");
    if ((await myPendingApplications(ctx.user.id)).length > 0) redirect("/pending");
    redirect("/onboarding");
  }
  return ctx as Ctx & { club: MyClub };
}

export async function requireRole(...roles: Role[]) {
  const ctx = await requireClub();
  if (!ctx.club.roles.some((r) => roles.includes(r))) redirect("/play");
  return ctx;
}

export const isAdmin = (c: MyClub) => c.roles.includes("admin");
/** Whether this person looks after an area of the club. The owner can do everything; other admins only what they were given. (The database checks the same rule.) */
export const can = (c: MyClub, perm: Permission) => isAdmin(c) && (c.isOwner || c.permissions.includes(perm));
export const canScore = (c: MyClub) => can(c, "competitions") || c.roles.includes("scorer");

/** Page guard for an area of the club: non-admins go to the player home, admins without that responsibility go to the admin home. */
export async function requirePermission(perm: Permission) {
  const ctx = await requireClub();
  if (!isAdmin(ctx.club)) redirect("/play");
  if (!can(ctx.club, perm)) redirect("/");
  return ctx;
}
/** Competition screens: the competitions admin or a scorer. */
export async function requireScoringAccess() {
  const ctx = await requireClub();
  if (!canScore(ctx.club)) redirect(isAdmin(ctx.club) ? "/" : "/play");
  return ctx;
}

/** Run a query as the current user in the active club. The only door to app-role data. */
export async function inClub<T>(ctx: Ctx & { club: MyClub }, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTenant(appDb(), { userId: ctx.user.id, clubId: ctx.club.clubId }, fn);
}
