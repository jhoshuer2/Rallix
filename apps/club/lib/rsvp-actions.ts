"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { inClub, requireClub } from "./context";

type Result = { ok: true; going: boolean } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WHY: Record<string, string> = { invalid: "That session isn’t on that day.", past: "You can only say you’re coming from today up to two months ahead.", closed: "The club is closed that day." };

/** "I'm coming" to one day of a session or event (or not any more). The database checks the day is real, not closed, and in range. */
export async function setComing(eventId: string, date: string, going: boolean): Promise<Result> {
  const ctx = await requireClub();
  if (!UUID.test(String(eventId)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, error: WHY.invalid! };
  const code = await inClub(ctx, async (tx) => String((await tx.execute(sql`select app.rsvp(${eventId}::uuid, ${date}::date, ${!!going}) as r`)).rows[0]?.r));
  if (code !== "going" && code !== "not_going") return { ok: false, error: WHY[code] ?? "Something went wrong." };
  revalidatePath("/play/calendar"); revalidatePath("/members/attendance");
  return { ok: true, going: code === "going" };
}
