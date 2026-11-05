"use server";
import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { arrivals, clubs, memberships, playerProfiles, pushSubscriptions, users } from "@rallix/db";
import { arrivalMessage, shouldAlert, withinVenue } from "@rallix/stats";
import { isPushEndpoint } from "@rallix/config/safe-input";
import { can, getCtx, inClub, requireClub } from "./context";
import { serviceDb } from "./db";
import { getVenue, HERE_HOURS } from "./arrival-queries";
import { sendToUsers } from "./push";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const pgCode = (e: unknown) => (e as { cause?: { code?: string }; code?: string })?.cause?.code ?? (e as { code?: string })?.code;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Save this device for lock-screen alerts. The subscription holds secrets, so it goes in through the service role, tied to the signed-in user. */
export async function savePushSubscription(input: { endpoint: string; p256dh: string; auth: string; userAgent?: string }): Promise<Result> {
  const ctx = await getCtx();
  if (!ctx) return fail("Please sign in again.");
  const { endpoint, p256dh, auth } = input ?? ({} as typeof input);
  if (!isPushEndpoint(endpoint)) return fail("This device can’t receive alerts.");
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length < 20 || p256dh.length > 200 || auth.length < 8 || auth.length > 100) return fail("This device can’t receive alerts.");
  const userAgent = typeof input.userAgent === "string" ? input.userAgent.slice(0, 200) : null;
  // A person has a few devices, not hundreds: keep the newest 10 so the table cannot be filled from one account.
  const mine = await serviceDb().select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, ctx.user.id)).orderBy(desc(pushSubscriptions.createdAt));
  for (const old of mine.slice(9)) await serviceDb().delete(pushSubscriptions).where(eq(pushSubscriptions.id, old.id));
  await serviceDb().insert(pushSubscriptions).values({ userId: ctx.user.id, endpoint, p256dh, auth, userAgent })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: ctx.user.id, p256dh, auth, userAgent } });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const ctx = await getCtx();
  if (!ctx) return fail("Please sign in again.");
  if (typeof endpoint !== "string") return fail("Nothing to remove.");
  await serviceDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, ctx.user.id)));
  return { ok: true };
}

/** Your own arrival switches for the active club. */
export async function saveArrivalSettings(input: { share: boolean; notify: boolean; auto: boolean }): Promise<Result> {
  const ctx = await requireClub();
  await inClub(ctx, (tx) => tx.update(playerProfiles).set({ shareArrival: !!input.share, notifyArrivals: !!input.notify, autoArrival: !!input.share && !!input.auto })
    .where(eq(playerProfiles.membershipId, ctx.club.membershipId)));
  revalidatePath("/play", "layout");
  return { ok: true };
}

/** Club admin sets the court location. The client reports the position of the admin standing at the court. */
export async function saveVenue(input: { lat: number; lng: number; label: string; radiusM: number }): Promise<Result> {
  const ctx = await requireClub();
  if (!can(ctx.club, "facilities")) return fail("Only the admin who looks after facilities can set the court.");
  const lat = num(input?.lat), lng = num(input?.lng), radius = num(input?.radiusM);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail("We couldn’t read your location. Try again outdoors.");
  if (radius === null || ![50, 100, 200].includes(radius)) return fail("Choose a radius from the list.");
  const label = String(input.label ?? "").trim().slice(0, 80) || null;
  await inClub(ctx, (tx) => tx.update(clubs).set({ venueLat: lat, venueLng: lng, venueLabel: label, venueRadiusM: radius }).where(eq(clubs.id, ctx.club.clubId)));
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * "I've arrived." The position comes from the phone, so it is checked HERE against the club's court and radius: the client
 * is never trusted to say it is in range. No coordinates are stored, only the time. Others are alerted at most once per 2 hours.
 */
export async function checkIn(input: { lat: number; lng: number; accuracy: number; method?: "manual" | "auto" }): Promise<Result<{ already?: boolean; alerted?: number }>> {
  const ctx = await requireClub();
  const lat = num(input?.lat), lng = num(input?.lng), acc = num(input?.accuracy);
  if (lat === null || lng === null || acc === null) return fail("We couldn’t read your location.");
  const method = input.method === "auto" ? "auto" : "manual";
  const me = ctx.club.membershipId;

  const pre = await inClub(ctx, async (tx) => {
    const venue = await getVenue(tx, ctx.club.clubId);
    const [p] = await tx.select({ share: playerProfiles.shareArrival }).from(playerProfiles).where(eq(playerProfiles.membershipId, me)).limit(1);
    return { venue, share: !!p?.share };
  });
  if (!pre.venue) return fail("Your club hasn’t set its court location yet.");
  if (!pre.share) return fail("Turn on “Share when I arrive” first.");
  const v = withinVenue({ lat, lng }, acc, pre.venue, pre.venue.radiusM);
  if (!v.ok) return fail(v.reason === "far" ? "You don’t seem to be at the court yet." : v.reason === "inaccurate" ? "Your location isn’t accurate enough. Step outside or try again." : "We couldn’t read your location.");

  let arrivalId: string | null = null;
  try {
    arrivalId = await inClub(ctx, async (tx) => {
      // An old open arrival (never checked out) must not block a new day.
      await tx.update(arrivals).set({ leftAt: sql`${arrivals.arrivedAt} + interval '${sql.raw(String(HERE_HOURS))} hours'` })
        .where(and(eq(arrivals.membershipId, me), isNull(arrivals.leftAt), sql`${arrivals.arrivedAt} < now() - interval '${sql.raw(String(HERE_HOURS))} hours'`));
      // Plain SQL on purpose: the app role may insert only these three columns (it cannot backdate an arrival), and Drizzle's insert names every column.
      const r = await tx.execute(sql`insert into arrivals (club_id, membership_id, method) values (${ctx.club.clubId}, ${me}, ${method}) returning id`);
      return (r.rows[0] as { id: string }).id;
    });
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: true, already: true }; // already marked as here: nothing to do, nobody alerted again
    throw e;
  }

  // Alert the others. Service role: it reads other people's opt-ins and writes the alert marker; recipients come from the DB, never from the client.
  const db = serviceDb();
  const [last] = await db.select({ at: sql<Date | null>`max(${arrivals.alertedAt})` }).from(arrivals).where(and(eq(arrivals.membershipId, me), isNotNull(arrivals.alertedAt)));
  let alerted = 0;
  if (shouldAlert(last?.at ? new Date(last.at) : null, new Date())) {
    const recipients = await db.select({ userId: memberships.userId }).from(playerProfiles)
      .innerJoin(memberships, eq(memberships.id, playerProfiles.membershipId))
      .innerJoin(clubs, eq(clubs.id, memberships.clubId))
      .where(and(eq(playerProfiles.clubId, ctx.club.clubId), eq(playerProfiles.notifyArrivals, true), eq(memberships.status, "active"), eq(clubs.status, "active"), ne(memberships.id, me), ne(memberships.userId, ctx.user.id)));
    const [{ n } = { n: 1 }] = await db.select({ n: sql<number>`count(*)::int` }).from(arrivals).where(and(eq(arrivals.clubId, ctx.club.clubId), isNull(arrivals.leftAt), sql`${arrivals.arrivedAt} > now() - interval '${sql.raw(String(HERE_HOURS))} hours'`));
    const [who] = await db.select({ name: users.name }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    const msg = arrivalMessage(who?.name ?? ctx.user.name, ctx.club.name, n);
    const r = await sendToUsers([...new Set(recipients.map((x) => x.userId))], { ...msg, url: "/play" });
    alerted = r.sent;
    await db.update(arrivals).set({ alertedAt: sql`now()` }).where(eq(arrivals.id, arrivalId));
  }
  revalidatePath("/play", "layout");
  return { ok: true, alerted };
}

/** "I've left." Closes only your own open arrival (row-level security enforces that too). */
export async function checkOut(): Promise<Result> {
  const ctx = await requireClub();
  await inClub(ctx, (tx) => tx.update(arrivals).set({ leftAt: sql`now()` }).where(and(eq(arrivals.membershipId, ctx.club.membershipId), isNull(arrivals.leftAt))));
  revalidatePath("/play", "layout");
  return { ok: true };
}
