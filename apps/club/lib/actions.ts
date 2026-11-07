"use server";
import { finishIfDone } from "./competition-finish";
import { randomBytes, randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { competitionEntries, competitions, dues, games, globalRatings, invites, matches, memberships, plans, ratingEvents, ratings, users, withTenant } from "@rallix/db";
import { applyElo, resolveMatch, roundRobin, snakeGroups, START_RATING, validateRules, type GameScore } from "@rallix/stats";
import { normalizePhone } from "@rallix/config/phone";
import { CLUB_COOKIE, canScore, getCtx, inClub, can, requireClub } from "./context";
import { appDb, serviceDb } from "./db";
import { listMembers } from "./queries";
import { savePhone } from "./contact";
import { seedAndGenerate } from "./competition-core";
import { clubRules, ruleColumns, type RuleSet } from "./match-rules";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const pgCode = (e: unknown) => (e as { cause?: { code?: string }; code?: string })?.cause?.code ?? (e as { code?: string })?.code;
const pgMsg = (e: unknown) => (e as { cause?: { message?: string } })?.cause?.message ?? "";

async function setClubCookie(clubId: string) {
  (await cookies()).set(CLUB_COOKIE, clubId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "") || "club";

/** Change the signed-in user's optional contact phone. Empty clears it. */
export async function updateContact(input: { phone: string }): Promise<Result> {
  const ctx = await getCtx();
  if (!ctx) return fail("Please sign in again.");
  if (!input.phone.trim()) { await serviceDb().update(users).set({ phoneNumber: null, phoneNumberVerified: false }).where(eq(users.id, ctx.user.id)); revalidatePath("/", "layout"); return { ok: true }; }
  const err = await savePhone(ctx.user.id, input.phone);
  if (err) return fail(err);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Onboarding ---------- */
export async function createClub(input: { clubName: string; yourName: string; location: string; phone?: string }): Promise<Result<{ clubId: string }>> {
  const ctx = await getCtx();
  if (!ctx) return fail("Please sign in again.");
  const clubName = input.clubName.trim(), yourName = input.yourName.trim(), location = input.location.trim();
  if (clubName.length < 2 || clubName.length > 60) return fail("Club name must be 2 to 60 characters.");
  if (yourName.length < 2) return fail("Enter your name.");
  const phoneProblem = await savePhone(ctx.user.id, input.phone);
  if (phoneProblem) return fail(phoneProblem);
  const base = slugify(clubName);
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    try {
      const clubId = await withTenant(appDb(), { userId: ctx.user.id }, async (tx) => {
        await tx.update(users).set({ name: yourName }).where(eq(users.id, ctx.user.id));
        const r = await tx.execute(sql`select app.create_club(${clubName}, ${slug}, ${location || null}) as id`);
        return (r.rows[0] as { id: string }).id;
      });
      await setClubCookie(clubId);
      return { ok: true, clubId };
    } catch (e) {
      if (pgCode(e) === "23505") continue; // slug taken, retry with a suffix
      return fail("Could not create the club. Please try again.");
    }
  }
  return fail("Could not find a free club address. Try a different name.");
}

/** 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L), so codes survive being read out or retyped. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function inviteCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/* ---------- Invites and plans (admin) ---------- */
export async function createInvite(): Promise<Result<{ code: string }>> {
  const ctx = await requireClub();
  if (!can(ctx.club, "members")) return fail("Only club admins can create invites.");
  const code = inviteCode();
  await inClub(ctx, (tx) => tx.insert(invites).values({ clubId: ctx.club.clubId, code, createdBy: ctx.club.membershipId, expiresAt: new Date(Date.now() + 30 * 86400000) }));
  revalidatePath("/profile/invite");
  return { ok: true, code };
}

export async function setPlanActive(planId: string, active: boolean): Promise<Result> {
  const ctx = await requireClub();
  if (!can(ctx.club, "finance")) return fail("Only club admins can change plans.");
  await inClub(ctx, (tx) => tx.update(plans).set({ active }).where(eq(plans.id, planId)));
  revalidatePath("/membership/subscriptions");
  return { ok: true };
}

export async function savePlan(input: { id?: string; name: string; naira: number; period: "monthly" | "yearly" }): Promise<Result> {
  const ctx = await requireClub();
  if (!can(ctx.club, "finance")) return fail("Only club admins can change plans.");
  const kobo = Math.round(input.naira * 100);
  if (!Number.isFinite(kobo) || kobo < 0 || kobo > 1_000_000_00) return fail("Enter a valid price.");
  try {
    if (input.id) await inClub(ctx, (tx) => tx.update(plans).set({ priceKobo: kobo }).where(eq(plans.id, input.id!)));
    else {
      if (input.name.trim().length < 2) return fail("Give the plan a name.");
      await inClub(ctx, (tx) => tx.insert(plans).values({ clubId: ctx.club.clubId, name: input.name.trim(), priceKobo: kobo, period: input.period, perks: ["unlimited open play", "competition entry"] }));
    }
  } catch (e) {
    if (pgCode(e) === "23505") return fail("A plan with that name and billing period already exists.");
    return fail("Could not save the plan.");
  }
  revalidatePath("/membership/subscriptions");
  return { ok: true };
}

/** Create dues for every active player on a plan for the current month. Safe to run twice. */
export async function billMembers(planId: string): Promise<Result<{ created: number }>> {
  const ctx = await requireClub();
  if (!can(ctx.club, "finance")) return fail("Only club admins can bill members.");
  const now = new Date();
  const label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const due = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const created = await inClub(ctx, async (tx) => {
    const [plan] = await tx.select().from(plans).where(eq(plans.id, planId));
    if (!plan) return 0;
    const members = await listMembers(tx, ctx.club.clubId);
    if (!members.length) return 0;
    const res = await tx.insert(dues).values(members.map((m) => ({ clubId: ctx.club.clubId, membershipId: m.id, planId: plan.id, amountKobo: plan.priceKobo, periodLabel: label, dueDate: due })))
      .onConflictDoNothing().returning({ id: dues.id });
    return res.length;
  });
  revalidatePath("/membership/payments");
  return { ok: true, created };
}

/* ---------- Competitions ---------- */
export async function createCompetition(input: {
  name: string; level: "junior" | "intermediate" | "senior" | null; format: "group_stage" | "one_on_one" | "knockout"; drawMethod?: "seeded" | "raffle"; startsOn: string; endsOn: string; memberIds: string[];
  /** Players sign up themselves; the competition stays a draft until an admin starts it. */
  openRegistration?: boolean; maxPlayers?: number | null; closesOn?: string | null;
  /** How many games and what decides a game. Left out = the club's usual rules. */
  matchRules?: { bestOf: number; points: number; winBy: number; cap: number | null };
}): Promise<Result<{ id: string; draft: boolean }>> {
  const ctx = await requireClub();
  if (!can(ctx.club, "competitions")) return fail("Only club admins can create competitions.");
  const name = input.name.trim();
  if (name.length < 2) return fail("Give the competition a name.");
  if (input.endsOn < input.startsOn) return fail("The end date must be on or after the start date.");
  const ids = [...new Set(input.memberIds)];
  const open = !!input.openRegistration;
  if (!open && ids.length < 2) return fail("Pick at least two players.");
  const max = open && input.maxPlayers ? Math.floor(Number(input.maxPlayers)) : null;
  if (max !== null && (!Number.isFinite(max) || max < 2 || max > 128)) return fail("Spots must be between 2 and 128.");
  if (max !== null && ids.length > max) return fail("You picked more players than there are spots.");
  const closes = open && input.closesOn ? input.closesOn : null;
  if (closes !== null && !/^\d{4}-\d{2}-\d{2}$/.test(closes)) return fail("Choose a valid closing date.");
  let chosen: RuleSet | null = null;
  if (input.matchRules) {
    const v = validateRules(input.matchRules);
    if (!v.ok) return fail(v.error);
    chosen = { bestOf: v.bestOf, rules: v.rules };
  }
  try {
    const id = await inClub(ctx, async (tx) => {
      const ruleSet = chosen ?? await clubRules(tx, ctx.club.clubId);
      const roster = await listMembers(tx, ctx.club.clubId); // RLS-scoped; also gives seed order by rating
      const valid = roster.filter((m) => ids.includes(m.id));
      if (valid.length !== ids.length) throw new Error("INVALID_PLAYERS");
      const [c] = await tx.insert(competitions).values({ clubId: ctx.club.clubId, name, level: input.level, format: input.format, drawMethod: input.drawMethod === "raffle" ? "raffle" : "seeded", status: open ? "draft" : "active", openRegistration: open, maxPlayers: max, registrationClosesOn: closes, startsOn: input.startsOn, endsOn: input.endsOn, ...ruleColumns(ruleSet), createdBy: ctx.club.membershipId }).returning({ id: competitions.id });
      if (open) { if (valid.length) await tx.insert(competitionEntries).values(valid.map((m) => ({ clubId: ctx.club.clubId, competitionId: c!.id, membershipId: m.id }))); }
      else await seedAndGenerate(tx, ctx.club.clubId, c!.id, input.format, valid, { drawMethod: input.drawMethod === "raffle" ? "raffle" : "seeded" });
      return c!.id;
    });
    revalidatePath("/competition");
    return { ok: true, id, draft: open };
  } catch (e) {
    if ((e as Error).message === "INVALID_PLAYERS") return fail("One or more players are not in this club.");
    return fail("Could not create the competition.");
  }
}

type Outcome = { error: string; conflict?: boolean } | { error: null; already: true } | { error: null; already?: false; m: typeof matches.$inferSelect; winnerId: string; loserId: string };
type Recorded = { ok: true; winnerName: string; already?: boolean } | { ok: false; error: string; conflict?: boolean };

/**
 * Record a finished match, then update Elo (club and global). Idempotent per match.
 * `clientRef` comes from an offline send: the same ref coming back means "this is ours, already saved", not a conflict.
 */
async function recordResult(ctx: Awaited<ReturnType<typeof requireClub>>, input: { matchId: string; games: GameScore[] }, clientRef?: string): Promise<Recorded> {
  if (!canScore(ctx.club)) return { ok: false, error: "Only scorers and admins can record results." };
  try {
    const out = await inClub<Outcome>(ctx, async (tx) => {
      const [m] = await tx.select().from(matches).where(eq(matches.id, input.matchId));
      if (!m) return { error: "Match not found." };
      if (m.status === "completed" || m.status === "walkover") {
        if (clientRef && m.clientRef === clientRef) return { error: null, already: true as const };
        return { error: "This match has already been recorded.", conflict: true };
      }
      if (!m.player1Id || !m.player2Id) return { error: "Both players must be set before scoring." };
      const r = resolveMatch(input.games, m.bestOf, { points: m.gamePoints, winBy: m.winBy === 1 ? 1 : 2, cap: m.pointCap });
      if (!r.valid) return { error: r.reason };
      const p1 = m.player1Id, p2 = m.player2Id;
      const winnerId = r.winnerSide === 1 ? p1 : p2;
      const loserId = r.winnerSide === 1 ? p2 : p1;
      const upd = await tx.update(matches).set({ status: "completed", winnerId, gamesP1: r.gamesP1, gamesP2: r.gamesP2, scorerId: ctx.club.membershipId, confirmedAt: new Date(), ...(clientRef ? { clientRef } : {}) })
        .where(and(eq(matches.id, m.id), sql`${matches.status} NOT IN ('completed','walkover')`)).returning({ id: matches.id });
      if (!upd.length) return { error: "This match has already been recorded.", conflict: true };
      await tx.insert(games).values(input.games.map((g, i) => ({ clubId: ctx.club.clubId, matchId: m.id, gameNo: i + 1, p1Points: g.p1, p2Points: g.p2, stopped: g.stopped === true })));
      // Knockout: the winner moves into the next match; deciding the final completes the competition. Same transaction as the result.
      if (m.feedsMatchId) {
        await tx.update(matches).set(m.feedsSlot === 1 ? { player1Id: winnerId } : { player2Id: winnerId }).where(and(eq(matches.id, m.feedsMatchId), eq(matches.competitionId, m.competitionId)));
      } else {
        const [c] = await tx.select({ format: competitions.format }).from(competitions).where(eq(competitions.id, m.competitionId)).limit(1);
        if (c?.format === "knockout") await tx.update(competitions).set({ status: "completed" }).where(eq(competitions.id, m.competitionId));
      }
      return { error: null, m, winnerId, loserId };
    });
    if (out.error !== null) return { ok: false, error: out.error, conflict: "conflict" in out ? out.conflict : undefined };
    if (out.already) return { ok: true, winnerName: "", already: true };
    await updateRatings(ctx.club.clubId, out.m.id, out.m.competitionId, out.winnerId, out.loserId);
    await finishIfDone(ctx.club.clubId, out.m.competitionId); // completes the competition and records the podium when every match is decided
    revalidatePath("/", "layout");
    const [w] = await inClub(ctx, (tx) => tx.select({ name: users.name }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.id, out.winnerId)));
    return { ok: true, winnerName: w?.name ?? "Winner" };
  } catch {
    return { ok: false, error: "Could not save the result. Please try again." };
  }
}

export async function saveResult(input: { matchId: string; games: GameScore[] }): Promise<Result<{ winnerName: string }>> {
  const ctx = await requireClub();
  const r = await recordResult(ctx, input);
  return r.ok ? { ok: true, winnerName: r.winnerName } : fail(r.error);
}

/** What the phone's outbox needs to know. `auth` = sign in again (never redirects: a redirect would break the background sync). */
export type SyncReply = { ok: true; already: boolean } | { ok: false; kind: "conflict" | "rejected" | "auth"; error: string };

/**
 * Send a result that was scored without a signal. Same checks as saveResult (scorer or admin, valid score, once per match);
 * `clientRef` makes a retry after a lost reply safe. The match's own club is used, whichever club is active in the app now.
 */
export async function syncOfflineResult(input: { clubId: string; matchId: string; games: GameScore[]; clientRef: string }): Promise<SyncReply> {
  if (!/^[0-9a-f-]{36}$/i.test(String(input.clubId)) || !/^[0-9a-f-]{36}$/i.test(String(input.matchId))) return { ok: false, kind: "rejected", error: "This result cannot be sent." };
  if (!/^[\w-]{8,64}$/.test(String(input.clientRef))) return { ok: false, kind: "rejected", error: "This result cannot be sent." };
  if (!Array.isArray(input.games) || input.games.length > 9) return { ok: false, kind: "rejected", error: "This result cannot be sent." };
  const ctx = await getCtx();
  if (!ctx) return { ok: false, kind: "auth", error: "Sign in again to send this result." };
  const club = ctx.clubs.find((c) => c.clubId === input.clubId);
  if (!club) return { ok: false, kind: "rejected", error: "You are no longer in the club this match belongs to." };
  const games: GameScore[] = input.games.map((g) => ({ p1: Number(g.p1), p2: Number(g.p2), stopped: g.stopped === true }));
  const r = await recordResult({ ...ctx, club }, { matchId: input.matchId, games }, input.clientRef);
  if (r.ok) return { ok: true, already: r.already === true };
  return { ok: false, kind: r.conflict ? "conflict" : "rejected", error: r.error };
}

/** Service role: ratings tables are not writable by the app role. Called only after saveResult's checks pass. */
async function updateRatings(clubId: string, matchId: string, competitionId: string, winnerId: string, loserId: string) {
  await serviceDb().transaction(async (tx) => {
    const seen = await tx.select({ id: ratingEvents.id }).from(ratingEvents).where(eq(ratingEvents.matchId, matchId)).limit(1);
    if (seen.length) return;
    const scopes: Array<{ scope: "club" | "competition"; competitionId: string | null }> = [{ scope: "club", competitionId: null }, { scope: "competition", competitionId }];
    for (const s of scopes) {
      const get = async (membershipId: string) => {
        const cond = and(eq(ratings.membershipId, membershipId), eq(ratings.scope, s.scope), s.competitionId ? eq(ratings.competitionId, s.competitionId) : sql`${ratings.competitionId} IS NULL`);
        const [row] = await tx.select().from(ratings).where(cond);
        if (row) return row;
        const [ins] = await tx.insert(ratings).values({ clubId, membershipId, scope: s.scope, competitionId: s.competitionId, rating: START_RATING }).returning();
        return ins!;
      };
      const w = await get(winnerId), l = await get(loserId);
      const next = applyElo(w.rating, l.rating);
      await tx.update(ratings).set({ rating: next.winner, matchesPlayed: w.matchesPlayed + 1, updatedAt: new Date() }).where(eq(ratings.id, w.id));
      await tx.update(ratings).set({ rating: next.loser, matchesPlayed: l.matchesPlayed + 1, updatedAt: new Date() }).where(eq(ratings.id, l.id));
      if (s.scope === "club") {
        await tx.insert(ratingEvents).values([
          { clubId, membershipId: winnerId, matchId, scope: "club", before: w.rating, after: next.winner },
          { clubId, membershipId: loserId, matchId, scope: "club", before: l.rating, after: next.loser },
        ]);
      }
    }
    // Global rating, per person across every club they play in.
    const people = await tx.select({ id: memberships.id, userId: memberships.userId }).from(memberships).where(sql`${memberships.id} IN (${winnerId}, ${loserId})`);
    const wu = people.find((p) => p.id === winnerId)!.userId, lu = people.find((p) => p.id === loserId)!.userId;
    const gw = await tx.select().from(globalRatings).where(eq(globalRatings.userId, wu)), gl = await tx.select().from(globalRatings).where(eq(globalRatings.userId, lu));
    const rw = gw[0]?.rating ?? START_RATING, rl = gl[0]?.rating ?? START_RATING;
    const next = applyElo(rw, rl);
    const up = (userId: string, rating: number, played: number) => tx.insert(globalRatings).values({ userId, rating, matchesPlayed: played + 1 })
      .onConflictDoUpdate({ target: globalRatings.userId, set: { rating, matchesPlayed: played + 1, updatedAt: new Date() } });
    await up(wu, next.winner, gw[0]?.matchesPlayed ?? 0);
    await up(lu, next.loser, gl[0]?.matchesPlayed ?? 0);
  });
}
