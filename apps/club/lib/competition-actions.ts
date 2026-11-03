"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { competitionEntries, competitions } from "@rallix/db";
import { sql } from "drizzle-orm";
import { inClub, can, requireClub } from "./context";
import { seedAndGenerate } from "./competition-core";
import { getCompetition, listMembers } from "./queries";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const JOIN_MESSAGES: Record<string, string> = {
  already: "You’re already registered.",
  full: "Sorry, this competition is full.",
  closed: "Registration for this competition is closed.",
  level: "This competition is for a different level.",
};

/** A player signs themselves up. The checks (open, deadline, spots, level) run in Postgres, which locks the competition so the last spot cannot be taken twice. */
export async function joinCompetition(id: string): Promise<Result<{ status: "joined" | "already" }>> {
  const ctx = await requireClub();
  if (!UUID.test(id)) return fail("We couldn’t find that competition.");
  const r = await inClub(ctx, (tx) => tx.execute(sql`select app.join_competition(${id}) as r`));
  const code = (r.rows[0] as { r: string }).r;
  revalidatePath("/play", "layout");
  if (code === "joined") return { ok: true, status: "joined" };
  if (code === "already") return { ok: true, status: "already" };
  return fail(JOIN_MESSAGES[code] ?? "We couldn’t register you. Please try again.");
}

export async function leaveCompetition(id: string): Promise<Result> {
  const ctx = await requireClub();
  if (!UUID.test(id)) return fail("We couldn’t find that competition.");
  const r = await inClub(ctx, (tx) => tx.execute(sql`select app.leave_competition(${id}) as r`));
  revalidatePath("/play", "layout");
  return (r.rows[0] as { r: string }).r === "left" ? { ok: true } : fail("You can’t leave a competition that has started.");
}

/** Admin: the preview details and the sign-up settings. Only an admin's session passes row-level security for this update. */
export async function saveCompetitionDetails(id: string, input: { summary: string; prize: string; rules: string; openRegistration: boolean; maxPlayers: number | null; closesOn: string | null; pointsWin?: number; pointsLoss?: number; seasonId?: string | null }): Promise<Result> {
  const ctx = await requireClub();
  if (!can(ctx.club, "competitions")) return fail("Only club admins can edit competitions.");
  if (!UUID.test(id)) return fail("We couldn’t find that competition.");
  const summary = input.summary.trim(), prize = input.prize.trim(), rules = input.rules.trim();
  if (summary.length > 140) return fail("Keep the summary under 140 characters.");
  if (prize.length > 100) return fail("Keep the prize under 100 characters.");
  if (rules.length > 8000) return fail("The rules are too long. Keep them under 8,000 characters.");
  const max = input.maxPlayers === null ? null : Math.floor(Number(input.maxPlayers));
  if (max !== null && (!Number.isFinite(max) || max < 2 || max > 128)) return fail("Spots must be between 2 and 128.");
  const closes = input.closesOn || null;
  if (closes !== null && !DATE.test(closes)) return fail("Choose a valid closing date.");
  const win = input.pointsWin === undefined ? undefined : Math.floor(Number(input.pointsWin)), loss = input.pointsLoss === undefined ? undefined : Math.floor(Number(input.pointsLoss));
  if ((win !== undefined && (!Number.isInteger(win) || win < 0 || win > 10)) || (loss !== undefined && (!Number.isInteger(loss) || loss < 0 || loss > 10))) return fail("Points must be whole numbers from 0 to 10.");
  if (win !== undefined && loss !== undefined && loss > win) return fail("A loss can’t be worth more than a win.");
  if (input.seasonId !== undefined && input.seasonId !== null && !UUID.test(input.seasonId)) return fail("Choose a season from the list.");
  const done = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return "missing";
    if (max !== null && c.status === "draft") {
      const [{ n } = { n: 0 }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(competitionEntries).where(eq(competitionEntries.competitionId, id)));
      if (max < n) return "below";
    }
    await tx.update(competitions).set({ summary: summary || null, prize: prize || null, rules: rules || null, openRegistration: !!input.openRegistration && c.status === "draft", maxPlayers: max, registrationClosesOn: closes, ...(win !== undefined ? { pointsWin: win } : {}), ...(loss !== undefined ? { pointsLoss: loss } : {}), ...(input.seasonId !== undefined ? { seasonId: input.seasonId } : {}) }).where(eq(competitions.id, id));
    return "ok";
  });
  if (done === "missing") return fail("We couldn’t find that competition.");
  if (done === "below") return fail("More players than that have already registered. Remove some first, or allow more spots.");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin: lock the sign-ups and generate the fixtures. Needs at least two entrants. */
export async function startCompetition(id: string): Promise<Result> {
  const ctx = await requireClub();
  if (!can(ctx.club, "competitions")) return fail("Only club admins can start a competition.");
  if (!UUID.test(id)) return fail("We couldn’t find that competition.");
  const res = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return "missing";
    if (c.status !== "draft") return "started";
    const entries = await tx.select({ id: competitionEntries.membershipId }).from(competitionEntries).where(eq(competitionEntries.competitionId, id));
    const roster = (await listMembers(tx, ctx.club.clubId)).filter((m) => entries.some((e) => e.id === m.id)); // best rating first
    if (roster.length < 2) return "few";
    await seedAndGenerate(tx, ctx.club.clubId, id, c.format, roster, { entriesExist: true, drawMethod: c.drawMethod === "raffle" ? "raffle" : "seeded" });
    await tx.update(competitions).set({ status: "active", openRegistration: false }).where(eq(competitions.id, id));
    return "ok";
  });
  if (res === "missing") return fail("We couldn’t find that competition.");
  if (res === "started") return fail("This competition has already started.");
  if (res === "few") return fail("You need at least two players to start.");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin: add players to a competition that has not started. */
export async function addEntrants(id: string, memberIds: string[]): Promise<Result<{ added: number }>> {
  const ctx = await requireClub();
  if (!can(ctx.club, "competitions")) return fail("Only club admins can add players.");
  if (!UUID.test(id) || !Array.isArray(memberIds) || memberIds.some((m) => !UUID.test(m))) return fail("Something went wrong. Please try again.");
  const added = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c || c.status !== "draft") return -1;
    const have = await tx.select({ m: competitionEntries.membershipId }).from(competitionEntries).where(eq(competitionEntries.competitionId, id));
    const valid = (await listMembers(tx, ctx.club.clubId)).filter((m) => memberIds.includes(m.id) && !have.some((h) => h.m === m.id));
    if (c.maxPlayers !== null && have.length + valid.length > c.maxPlayers) return -2;
    if (valid.length) await tx.insert(competitionEntries).values(valid.map((m) => ({ clubId: ctx.club.clubId, competitionId: id, membershipId: m.id })));
    return valid.length;
  });
  if (added === -1) return fail("Players can only be added before the competition starts.");
  if (added === -2) return fail("That would be more than the spot limit.");
  revalidatePath("/", "layout");
  return { ok: true, added };
}

export async function removeEntrant(id: string, memberId: string): Promise<Result> {
  const ctx = await requireClub();
  if (!can(ctx.club, "competitions")) return fail("Only club admins can remove players.");
  if (!UUID.test(id) || !UUID.test(memberId)) return fail("Something went wrong. Please try again.");
  const ok = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c || c.status !== "draft") return false;
    await tx.delete(competitionEntries).where(and(eq(competitionEntries.competitionId, id), eq(competitionEntries.membershipId, memberId)));
    return true;
  });
  if (!ok) return fail("Players can only be removed before the competition starts.");
  revalidatePath("/", "layout");
  return { ok: true };
}
