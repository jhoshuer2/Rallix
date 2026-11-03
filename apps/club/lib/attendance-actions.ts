"use server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { dues, memberships, users, playerProfiles, arrivals } from "@rallix/db";
import { standing, STANDING_LABEL, type Standing } from "@rallix/stats";
import { getCtx, inClub, requirePermission } from "./context";
import { serviceDb } from "./db";
import { issueCard, readCard } from "./card";
import { todayInClub } from "./highlights";


type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A fresh card token for the signed-in player in the active club. Refreshed every minute by the card page. */
export async function newCardToken(): Promise<{ ok: true; token: string } | Fail> {
  const ctx = await getCtx();
  if (!ctx?.club) return fail("Please sign in again.");
  return { ok: true, token: issueCard(ctx.club.clubId, ctx.club.membershipId) };
}

export type Scanned = { id: string; name: string; photo: string | null; standing: Standing; standingLabel: string; here: boolean };

async function describe(clubId: string, memberId: string): Promise<Scanned | null> {
  const db = serviceDb();
  const [m] = await db.select({ id: memberships.id, name: users.name, photo: playerProfiles.photoUrl }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId)).leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id))
    .where(and(eq(memberships.id, memberId), eq(memberships.clubId, clubId), eq(memberships.status, "active"))).limit(1);
  if (!m) return null;
  // Standing only (paid up or not), never amounts: the Members admin does not need the money.
  const d = await db.select({ status: dues.status, dueDate: dues.dueDate }).from(dues).where(and(eq(dues.membershipId, memberId), eq(dues.clubId, clubId)));
  const s = standing(d.map((x) => ({ status: x.status, dueDate: String(x.dueDate) })), todayInClub());
  const [open] = await db.select({ id: arrivals.id }).from(arrivals).where(and(eq(arrivals.membershipId, memberId), isNull(arrivals.leftAt), sql`${arrivals.arrivedAt} > now() - interval '6 hours'`)).limit(1);
  return { id: m.id, name: m.name, photo: m.photo ?? null, standing: s, standingLabel: STANDING_LABEL[s], here: !!open };
}

/** What a scanned card says. The token proves the phone; the Members admin check proves the scanner. */
export async function lookupCard(token: string): Promise<{ ok: true; person: Scanned } | Fail> {
  const ctx = await requirePermission("members");
  const t = readCard(token);
  if (!t) return fail("This card has expired or isn’t valid. Ask them to reopen it.");
  if (t.club !== ctx.club.clubId) return fail("This card is for a different club.");
  const person = await describe(ctx.club.clubId, t.member);
  if (!person) return fail("This person isn’t an active member of the club.");
  return { ok: true, person };
}

export async function doorCheckIn(memberId: string): Promise<{ ok: true; message: string } | Fail> {
  const ctx = await requirePermission("members");
  if (!UUID.test(String(memberId))) return fail("That member no longer exists.");
  const code = await inClub(ctx, async (tx) => String((await tx.execute(sql`select app.door_check_in(${memberId}::uuid) as r`)).rows[0]?.r));
  if (code === "in") { revalidatePath("/members/attendance"); return { ok: true, message: "Checked in." }; }
  if (code === "already") return { ok: true, message: "Already checked in." };
  return fail(code === "unknown" ? "That member no longer exists." : "You can’t check people in.");
}

export async function doorCheckOut(memberId: string): Promise<{ ok: true; message: string } | Fail> {
  const ctx = await requirePermission("members");
  if (!UUID.test(String(memberId))) return fail("That member no longer exists.");
  const code = await inClub(ctx, async (tx) => String((await tx.execute(sql`select app.door_check_out(${memberId}::uuid) as r`)).rows[0]?.r));
  if (code === "out" || code === "none") { revalidatePath("/members/attendance"); return { ok: true, message: code === "out" ? "Checked out." : "Wasn’t checked in." }; }
  return fail("You can’t check people out.");
}
