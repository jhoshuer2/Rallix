"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clubs } from "@rallix/db";
import { validateRules } from "@rallix/stats";
import { can, inClub, requireClub } from "./context";

type Result = { ok: true } | { ok: false; error: string };

/**
 * The club's usual match rules (games in a match, points to win a game, what happens one short of the target). New competitions start
 * with these. Runs as the signed-in admin, so row-level security and the column grant are the second lock.
 */
export async function saveClubMatchRules(input: { bestOf: number; points: number; winBy: number; cap: number | null }): Promise<Result> {
  const ctx = await requireClub();
  if (!can(ctx.club, "competitions")) return { ok: false, error: "Only the admin who looks after competitions can change the match rules." };
  const v = validateRules(input ?? {});
  if (!v.ok) return { ok: false, error: v.error };
  const done = await inClub(ctx, (tx) => tx.update(clubs).set({ defaultBestOf: v.bestOf, defaultGamePoints: v.rules.points, defaultWinBy: v.rules.winBy, defaultPointCap: v.rules.cap }).where(eq(clubs.id, ctx.club.clubId)).returning({ id: clubs.id }));
  if (!done.length) return { ok: false, error: "Could not save. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}
