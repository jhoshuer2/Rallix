import { competitionEntries, competitions, matches, type Tx } from "@rallix/db";
import { ruleColumns, ruleSetOf } from "./match-rules";
import { buildKnockout, drawOrder, roundRobin, snakeGroups, type DrawMethod } from "@rallix/stats";

/**
 * Seed the entrants (best rating first) and generate the round-robin fixtures. Used when an admin creates a competition with a
 * fixed list of players, and when an admin starts a competition that players signed up for. `players` must already be ordered by rating.
 * Must run as the signed-in admin (row-level security is the lock on the inserts).
 */
export async function seedAndGenerate(tx: Tx, clubId: string, competitionId: string, format: string, players: Array<{ id: string }>, opts: { entriesExist?: boolean; drawMethod?: DrawMethod } = {}) {
  // Every match is made with the competition's rules (best of, points, win by).
  const [comp] = await tx.select({ bestOf: competitions.bestOf, gamePoints: competitions.gamePoints, winBy: competitions.winBy, pointCap: competitions.pointCap }).from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  const rules = comp ? ruleColumns(ruleSetOf(comp)) : {};
  // A knockout takes its seeds from the draw: by rating as given, or a raffle done once, right here.
  if (format === "knockout") players = drawOrder(players, opts.drawMethod ?? "seeded");
  if (opts.entriesExist) {
    for (const [i, p] of players.entries()) {
      await tx.update(competitionEntries).set({ seed: i + 1 }).where(and2(competitionId, p.id));
    }
  } else {
    await tx.insert(competitionEntries).values(players.map((m, i) => ({ clubId, competitionId, membershipId: m.id, seed: i + 1, groupLabel: null })));
  }
  if (format === "knockout") {
    await generateKnockout(tx, clubId, competitionId, players, rules);
    await tx.update(competitions).set({ drawMethod: opts.drawMethod ?? "seeded", drawnAt: new Date() }).where(eq(competitions.id, competitionId));
    return;
  }
  const groups = format === "group_stage" ? snakeGroups(players, Math.max(1, Math.ceil(players.length / 4))) : [players];
  const rows: Array<typeof matches.$inferInsert> = [];
  groups.forEach((g, gi) => {
    const label = format === "group_stage" ? `Group ${String.fromCharCode(65 + gi)}` : "One on one";
    roundRobin(g).forEach((round, ri) => round.forEach(([a, b], si) => rows.push({ ...rules, clubId, competitionId, round: label, roundOrder: ri + 1, slot: si + 1, player1Id: a.id, player2Id: b.id })));
  });
  if (rows.length) await tx.insert(matches).values(rows);
}

import { and, eq } from "drizzle-orm";
const and2 = (competitionId: string, membershipId: string) => and(eq(competitionEntries.competitionId, competitionId), eq(competitionEntries.membershipId, membershipId));

/** Insert the whole bracket, last round first so every match knows the id of the match it feeds. Byes are recorded as walkovers. */
async function generateKnockout(tx: Tx, clubId: string, competitionId: string, players: Array<{ id: string }>, rules: Partial<typeof matches.$inferInsert> = {}) {
  const bracket = buildKnockout(players.map((p) => p.id));
  const ids = new Map<string, string>(); // "round:slot" -> match id
  for (let r = bracket.rounds.length; r >= 1; r--) {
    const round = bracket.rounds[r - 1]!;
    for (const m of round) {
      const next = m.feeds ? ids.get(`${m.feeds.round}:${m.feeds.slot}`)! : null;
      const [row] = await tx.insert(matches).values({
        ...rules, clubId, competitionId, round: m.name, roundOrder: r, slot: m.slot + 1, player1Id: m.a, player2Id: m.b,
        status: m.bye ? "walkover" : "scheduled", winnerId: m.bye ? m.winner : null, confirmedAt: m.bye ? new Date() : null,
        feedsMatchId: next, feedsSlot: m.feeds ? m.feeds.side : null,
      }).returning({ id: matches.id });
      ids.set(`${r}:${m.slot}`, row!.id);
    }
  }
}
