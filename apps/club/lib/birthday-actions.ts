"use server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { playerProfiles } from "@rallix/db";
import { birthdayToDate } from "@rallix/stats";
import { inClub, requireClub } from "./context";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Save the signed-in person's own birthday (month and day) and whether the club may see it. Runs as the user, so row-level security
 * lets it touch only their own profile in the active club. `month: null` removes the birthday. A real birth year already on file is kept.
 */
export async function saveBirthday(input: { month: number | null; day: number | null; show: boolean }): Promise<Result> {
  const ctx = await requireClub();
  const show = input?.show !== false;
  try {
    await inClub(ctx, async (tx) => {
      const [cur] = await tx.select({ dob: playerProfiles.dateOfBirth }).from(playerProfiles).where(eq(playerProfiles.membershipId, ctx.club.membershipId)).limit(1);
      let date: string | null = null;
      if (input?.month !== null && input?.month !== undefined) {
        const keep = cur?.dob && Number(cur.dob.slice(0, 4)) > 1904 ? Number(cur.dob.slice(0, 4)) : null;
        const r = birthdayToDate(input.month, input.day, keep);
        if (!r.ok) throw new Error(r.error);
        date = r.date;
      }
      if (cur) await tx.update(playerProfiles).set({ dateOfBirth: date, showBirthday: show }).where(eq(playerProfiles.membershipId, ctx.club.membershipId));
      else await tx.execute(sqlInsert(ctx.club.clubId, ctx.club.membershipId, date, show));
    });
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, error: /month|day|date/i.test(msg) && msg.length < 60 ? msg : "Could not save. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const sqlInsert = (clubId: string, membershipId: string, date: string | null, show: boolean) =>
  sql`insert into player_profiles (membership_id, club_id, date_of_birth, show_birthday) values (${membershipId}, ${clubId}, ${date}, ${show}) on conflict (membership_id) do update set date_of_birth = excluded.date_of_birth, show_birthday = excluded.show_birthday`;
