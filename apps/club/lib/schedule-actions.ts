"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clubEvents } from "@rallix/db";
import { inClub, requirePermission } from "./context";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDate = (d: string) => DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

export interface EventInput { kind: string; title: string; note?: string; startsOn: string; endsOn?: string; startTime?: string; endTime?: string; repeatsWeekly?: boolean; until?: string }

type Clean = { kind: "play" | "event" | "closed"; title: string; note: string | null; startsOn: string; endsOn: string | null; startTime: string | null; endTime: string | null; repeatsWeekly: boolean; until: string | null };

function clean(i: EventInput): { ok: true; v: Clean } | { ok: false; error: string } {
  const kind = i?.kind;
  if (kind !== "play" && kind !== "event" && kind !== "closed") return fail("Choose what this is.");
  const title = String(i.title ?? "").trim();
  if (title.length < 1 || title.length > 80) return fail("Give it a short title (up to 80 characters).");
  const note = String(i.note ?? "").trim().slice(0, 280) || null;
  if (!validDate(String(i.startsOn))) return fail("Choose a date.");
  const endsOn = i.endsOn ? String(i.endsOn) : null;
  if (endsOn && (!validDate(endsOn) || endsOn < i.startsOn)) return fail("The last day can’t be before the first day.");
  const startTime = i.startTime ? String(i.startTime) : null, endTime = i.endTime ? String(i.endTime) : null;
  if ((startTime && !TIME.test(startTime)) || (endTime && !TIME.test(endTime))) return fail("Times look like 18:00.");
  if (endTime && !startTime) return fail("Add a start time too.");
  if (startTime && endTime && endTime <= startTime) return fail("It has to end after it starts.");
  const repeatsWeekly = kind === "play" && !!i.repeatsWeekly;
  const until = repeatsWeekly && i.until ? String(i.until) : null;
  if (until && (!validDate(until) || until < i.startsOn)) return fail("“Until” can’t be before the first day.");
  return { ok: true, v: { kind, title, note, startsOn: i.startsOn, endsOn: kind === "play" ? null : endsOn, startTime: kind === "closed" ? null : startTime, endTime: kind === "closed" ? null : endTime, repeatsWeekly, until } };
}

export async function saveScheduleEvent(id: string | null, input: EventInput): Promise<Result> {
  const ctx = await requirePermission("facilities");
  const c = clean(input);
  if (!c.ok) return c;
  const v = c.v;
  if (id !== null && !UUID.test(String(id))) return fail("That entry no longer exists.");
  const r = await inClub(ctx, async (tx) => {
    if (id) return (await tx.update(clubEvents).set({ ...v, updatedAt: new Date() }).where(and(eq(clubEvents.id, id), eq(clubEvents.clubId, ctx.club.clubId))).returning({ id: clubEvents.id })).length;
    await tx.insert(clubEvents).values({ ...v, clubId: ctx.club.clubId });
    return 1;
  });
  if (!r) return fail("That entry no longer exists.");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteScheduleEvent(id: string): Promise<Result> {
  const ctx = await requirePermission("facilities");
  if (!UUID.test(String(id))) return fail("That entry no longer exists.");
  await inClub(ctx, (tx) => tx.delete(clubEvents).where(and(eq(clubEvents.id, id), eq(clubEvents.clubId, ctx.club.clubId))));
  revalidatePath("/", "layout");
  return { ok: true };
}
