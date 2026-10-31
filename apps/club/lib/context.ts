import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { clubs, memberships, withTenant, type Tx } from "@rallix/db";
import { auth } from "./auth";
import { appDb } from "./db";

export type Role = "admin" | "scorer" | "coach" | "player";
export type MyClub = { clubId: string; membershipId: string; name: string; slug: string; logoUrl: string | null; roles: Role[] };
export type Ctx = { user: { id: string; name: string; image: string | null }; clubs: MyClub[]; club: MyClub | null };

export const CLUB_COOKIE = "rallix_club";

export const getSessionUser = cache(async () => {
  const s = await auth().api.getSession({ headers: await headers() });
  return s?.user ?? null;
});

/** Signed-in user, their clubs and the active club (from the cookie, else the first). */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const rows = await withTenant(appDb(), { userId: user.id }, (tx) =>
    tx.select({ clubId: clubs.id, membershipId: memberships.id, name: clubs.name, slug: clubs.slug, logoUrl: clubs.logoUrl, roles: memberships.roles })
      .from(memberships).innerJoin(clubs, eq(clubs.id, memberships.clubId))
      .where(and(eq(memberships.userId, user.id), eq(memberships.status, "active")))
      .orderBy(clubs.name));
  const wanted = (await cookies()).get(CLUB_COOKIE)?.value;
  const club = rows.find((c) => c.clubId === wanted) ?? rows[0] ?? null;
  return { user: { id: user.id, name: user.name, image: user.image ?? null }, clubs: rows as MyClub[], club: club as MyClub | null };
});

/** Page guard: signed in and belongs to a club. New users are sent to create or join one. */
export async function requireClub(): Promise<Ctx & { club: MyClub }> {
  const ctx = await getCtx();
  if (!ctx) redirect("/sign-in");
  if (!ctx.club) redirect("/onboarding");
  return ctx as Ctx & { club: MyClub };
}

export async function requireRole(...roles: Role[]) {
  const ctx = await requireClub();
  if (!ctx.club.roles.some((r) => roles.includes(r))) redirect("/play");
  return ctx;
}

export const isAdmin = (c: MyClub) => c.roles.includes("admin");
export const canScore = (c: MyClub) => c.roles.includes("admin") || c.roles.includes("scorer");

/** Run a query as the current user in the active club. The only door to app-role data. */
export async function inClub<T>(ctx: Ctx & { club: MyClub }, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTenant(appDb(), { userId: ctx.user.id, clubId: ctx.club.clubId }, fn);
}
