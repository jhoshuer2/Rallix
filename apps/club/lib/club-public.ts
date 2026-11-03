import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { clubPages, clubs, invites, plans } from "@rallix/db";
import { serviceDb } from "./db";

/** What a stranger may see about a club. Never members, never emails, never anything personal. */
export type PublicClub = {
  id: string; name: string; slug: string; logoUrl: string | null; coverUrl: string | null; location: string | null;
  about: string | null; schedule: string | null; dressCode: string | null; equipment: string | null; rules: string | null; contact: string | null;
  joinMode: "review" | "open"; published: boolean;
  fees: Array<{ name: string; priceKobo: number; period: "monthly" | "yearly" }>;
};

/** Invite codes are 8 characters from our alphabet. Check the shape before touching the database. */
export const isInviteCodeShape = (c: unknown): c is string => typeof c === "string" && /^[A-Z0-9]{6,12}$/.test(c);
export const isSlugShape = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$/.test(s);

async function load(clubId: string): Promise<PublicClub | null> {
  const db = serviceDb();
  const [c] = await db.select({ id: clubs.id, name: clubs.name, slug: clubs.slug, logoUrl: clubs.logoUrl, coverUrl: clubs.coverUrl, location: clubs.location, status: clubs.status }).from(clubs).where(eq(clubs.id, clubId));
  if (!c || c.status !== "active") return null;
  const [p] = await db.select().from(clubPages).where(eq(clubPages.clubId, clubId));
  const fees = await db.select({ name: plans.name, priceKobo: plans.priceKobo, period: plans.period }).from(plans).where(and(eq(plans.clubId, clubId), eq(plans.active, true))).orderBy(asc(plans.period), asc(plans.priceKobo));
  return {
    id: c.id, name: c.name, slug: c.slug, logoUrl: c.logoUrl, coverUrl: c.coverUrl, location: c.location,
    about: p?.about ?? null, schedule: p?.schedule ?? null, dressCode: p?.dressCode ?? null, equipment: p?.equipment ?? null, rules: p?.rules ?? null, contact: p?.contact ?? null,
    joinMode: p?.joinMode === "open" ? "open" : "review", published: !!p?.published, fees,
  };
}

/** The club behind a valid invite link. Holding the link is permission to read the club page, even before it is published. */
export async function lookupClubByCode(code: unknown): Promise<PublicClub | null> {
  if (!isInviteCodeShape(code)) return null;
  const [inv] = await serviceDb().select({ clubId: invites.clubId }).from(invites)
    .where(and(eq(invites.code, code), isNull(invites.revokedAt), or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())), or(isNull(invites.maxUses), sql`${invites.uses} < ${invites.maxUses}`)));
  return inv ? load(inv.clubId) : null;
}

/** The public page of a club, only when its admins published it. */
export async function lookupClubBySlug(slug: unknown): Promise<PublicClub | null> {
  if (!isSlugShape(slug)) return null;
  const [c] = await serviceDb().select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, slug));
  if (!c) return null;
  const club = await load(c.id);
  return club && club.published ? club : null;
}
