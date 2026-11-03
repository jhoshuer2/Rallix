"use server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { challenges, globalRatings, memberships, ratings } from "@rallix/db";
import { applyElo, friendlyEloDelta, isRated, START_RATING, validFriendlyScore, winnerOf } from "@rallix/stats";
import { inClub, requireClub } from "./context";
import { serviceDb } from "./db";
import { sendToUsers } from "./push";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WHY: Record<string, string> = {
  self: "You can’t challenge yourself.", unknown: "That player isn’t in this club.", invalid: "Something in that challenge isn’t right.",
  past: "Pick a time that hasn’t passed.", exists: "You already have an open challenge with this player.",
  limit: "You have five challenges waiting for an answer. Wait for some replies first.", denied: "You can’t do that.", closed: "This challenge has already moved on.",
};
const why = (code: string) => WHY[code] ?? "Something went wrong.";

/** Run one of the SQL entry points as the signed-in user. The database decides who may do what. */
async function call(q: ReturnType<typeof sql>): Promise<string> {
  const ctx = await requireClub();
  return inClub(ctx, async (tx) => String((await tx.execute(q)).rows[0]?.r ?? "denied"));
}

/** Quiet heads-up to the other player: name only, no scores or messages. Never throws. */
async function nudge(toMembership: string, text: (me: string, club: string) => { title: string; body: string }) {
  try {
    const ctx = await requireClub();
    const [to] = await serviceDb().select({ userId: memberships.userId }).from(memberships)
      .where(and(eq(memberships.id, toMembership), eq(memberships.clubId, ctx.club.clubId), eq(memberships.status, "active"))).limit(1);
    if (!to || to.userId === ctx.user.id) return;
    await sendToUsers([to.userId], { ...text(ctx.user.name, ctx.club.name), url: "/play/friendlies" });
  } catch { /* an alert never fails the action */ }
}

export async function challengePlayer(input: { opponentId: string; when?: string | null; message?: string; bestOf: number; rated: boolean }): Promise<Result> {
  if (!UUID.test(String(input?.opponentId))) return fail(why("unknown"));
  const best = Number(input.bestOf);
  let when: Date | null = null;
  if (input.when) { when = new Date(input.when); if (Number.isNaN(when.getTime())) return fail(why("invalid")); }
  const msg = String(input.message ?? "").trim().slice(0, 140) || null;
  const code = await call(sql`select app.propose_challenge(${input.opponentId}::uuid, ${when ? when.toISOString() : null}::timestamptz, ${msg}, ${best}, ${!!input.rated}) as r`);
  if (code !== "sent") return fail(why(code));
  await nudge(input.opponentId, (me, club) => ({ title: `${me} challenged you`, body: `${club} · friendly match` }));
  revalidatePath("/play", "layout");
  return { ok: true, message: "Challenge sent." };
}

export async function answerChallenge(id: string, accept: boolean, rated = false): Promise<Result> {
  if (!UUID.test(String(id))) return fail(why("unknown"));
  const code = await call(sql`select app.respond_challenge(${id}::uuid, ${!!accept}, ${!!rated}) as r`);
  if (code !== "accepted" && code !== "declined") return fail(why(code));
  revalidatePath("/play", "layout");
  return { ok: true, message: code === "accepted" ? "Challenge accepted." : "Challenge declined." };
}

export async function cancelChallenge(id: string): Promise<Result> {
  if (!UUID.test(String(id))) return fail(why("unknown"));
  const code = await call(sql`select app.cancel_challenge(${id}::uuid) as r`);
  if (code !== "cancelled") return fail(why(code));
  revalidatePath("/play", "layout");
  return { ok: true, message: "Challenge called off." };
}

/** Games won by me and by them. The other player confirms. */
export async function enterChallengeResult(id: string, mine: number, theirs: number): Promise<Result> {
  if (!UUID.test(String(id))) return fail(why("unknown"));
  const m = Number(mine), t = Number(theirs);
  if (!Number.isInteger(m) || !Number.isInteger(t)) return fail("Enter whole numbers.");
  const ctx = await requireClub();
  const [c] = await inClub(ctx, (tx) => tx.select({ bestOf: challenges.bestOf, challenger: challenges.challengerId, opponent: challenges.opponentId }).from(challenges).where(eq(challenges.id, id)).limit(1));
  if (!c) return fail(why("unknown"));
  if (!validFriendlyScore(c.bestOf, m, t)) return fail(`In a best of ${c.bestOf}, one player wins ${Math.floor(c.bestOf / 2) + 1} games and the other fewer.`);
  const code = await call(sql`select app.record_challenge_result(${id}::uuid, ${m}, ${t}) as r`);
  if (code !== "recorded") return fail(why(code));
  const other = c.challenger === ctx.club.membershipId ? c.opponent : c.challenger;
  await nudge(other, (me, club) => ({ title: `${me} entered your score`, body: `${club} · please confirm` }));
  revalidatePath("/play", "layout");
  return { ok: true, message: "Score sent for confirmation." };
}

/** Confirm (and say whether it counts for the ranking) or dispute. When both players agreed to rate it, ratings move once, here. */
export async function confirmChallengeResult(id: string, ok: boolean, rated = false): Promise<Result> {
  if (!UUID.test(String(id))) return fail(why("unknown"));
  const code = await call(sql`select app.confirm_challenge_result(${id}::uuid, ${!!ok}, ${!!rated}) as r`);
  if (code === "disputed") { revalidatePath("/play", "layout"); return { ok: true, message: "Score cleared. Enter it again." }; }
  if (code !== "confirmed") return fail(why(code));
  await applyFriendlyRating(id);
  revalidatePath("/play", "layout");
  return { ok: true, message: "Result confirmed." };
}

/**
 * Service role, called only after the app-role checks above passed. Idempotent: the claim `rated_at IS NULL` is taken once.
 * Only the club rating and the global rating move; competition ratings are untouched.
 */
async function applyFriendlyRating(id: string) {
  await serviceDb().transaction(async (tx) => {
    const [c] = await tx.select().from(challenges).where(and(eq(challenges.id, id), eq(challenges.status, "confirmed"), isNull(challenges.ratedAt))).for("update");
    if (!c || !isRated(c)) return;
    const winner = winnerOf(c);
    if (!winner) return;
    const clubId = c.clubId;
    const get = async (membershipId: string) => {
      const [row] = await tx.select().from(ratings).where(and(eq(ratings.membershipId, membershipId), eq(ratings.scope, "club"), sql`${ratings.competitionId} IS NULL`));
      if (row) return row;
      const [ins] = await tx.insert(ratings).values({ clubId, membershipId, scope: "club", competitionId: null, rating: START_RATING }).returning();
      return ins!;
    };
    const a = await get(c.challengerId), b = await get(c.opponentId);
    const next = friendlyEloDelta({ challenger: a.rating, opponent: b.rating }, winner === c.challengerId, applyElo);
    await tx.update(ratings).set({ rating: next.challenger, matchesPlayed: a.matchesPlayed + 1, updatedAt: new Date() }).where(eq(ratings.id, a.id));
    await tx.update(ratings).set({ rating: next.opponent, matchesPlayed: b.matchesPlayed + 1, updatedAt: new Date() }).where(eq(ratings.id, b.id));
    const people = await tx.select({ id: memberships.id, userId: memberships.userId }).from(memberships).where(sql`${memberships.id} IN (${c.challengerId}, ${c.opponentId})`);
    const cu = people.find((p) => p.id === c.challengerId)!.userId, ou = people.find((p) => p.id === c.opponentId)!.userId;
    const ga = await tx.select().from(globalRatings).where(eq(globalRatings.userId, cu)), gb = await tx.select().from(globalRatings).where(eq(globalRatings.userId, ou));
    const gn = friendlyEloDelta({ challenger: ga[0]?.rating ?? START_RATING, opponent: gb[0]?.rating ?? START_RATING }, winner === c.challengerId, applyElo);
    const up = (userId: string, rating: number, played: number) => tx.insert(globalRatings).values({ userId, rating, matchesPlayed: played + 1 })
      .onConflictDoUpdate({ target: globalRatings.userId, set: { rating, matchesPlayed: played + 1, updatedAt: new Date() } });
    await up(cu, gn.challenger, ga[0]?.matchesPlayed ?? 0);
    await up(ou, gn.opponent, gb[0]?.matchesPlayed ?? 0);
    await tx.update(challenges).set({ ratedAt: new Date(), challengerBefore: a.rating, challengerAfter: next.challenger, opponentBefore: b.rating, opponentAfter: next.opponent }).where(eq(challenges.id, id));
  });
}
