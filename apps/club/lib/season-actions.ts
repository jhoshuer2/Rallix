"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { seasons } from "@rallix/db";
import { inClub, requirePermission } from "./context";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

/** Create (id null) or edit a season. The Competitions admin only; a season is never deleted, it just ends. */
export async function saveSeason(id: string | null, input: { name: string; startsOn: string; endsOn: string }): Promise<Result> {
  const ctx = await requirePermission("competitions");
  const name = String(input?.name ?? "").trim();
  if (name.length < 1 || name.length > 60) return fail("Give the season a short name (up to 60 characters).");
  if (!validDate(input.startsOn) || !validDate(input.endsOn)) return fail("Choose a start and an end date.");
  if (input.endsOn < input.startsOn) return fail("The season can’t end before it starts.");
  if (id !== null && !UUID.test(String(id))) return fail("That season no longer exists.");
  const n = await inClub(ctx, async (tx) => {
    if (id) return (await tx.update(seasons).set({ name, startsOn: input.startsOn, endsOn: input.endsOn }).where(and(eq(seasons.id, id), eq(seasons.clubId, ctx.club.clubId))).returning({ id: seasons.id })).length;
    await tx.insert(seasons).values({ clubId: ctx.club.clubId, name, startsOn: input.startsOn, endsOn: input.endsOn });
    return 1;
  });
  if (!n) return fail("That season no longer exists.");
  revalidatePath("/", "layout");
  return { ok: true };
}
