import { competitionEntries, matches, type Tx } from "@rallix/db";
import { roundRobin, snakeGroups } from "@rallix/stats";

/**
 * Seed the entrants (best rating first) and generate the round-robin fixtures. Used when an admin creates a competition with a
 * fixed list of players, and when an admin starts a competition that players signed up for. `players` must already be ordered by rating.
 * Must run as the signed-in admin (row-level security is the lock on the inserts).
 */
export async function seedAndGenerate(tx: Tx, clubId: string, competitionId: string, format: string, players: Array<{ id: string }>, opts: { entriesExist?: boolean } = {}) {
  if (opts.entriesExist) {
    for (const [i, p] of players.entries()) {
      await tx.update(competitionEntries).set({ seed: i + 1 }).where(and2(competitionId, p.id));
    }
  } else {
    await tx.insert(competitionEntries).values(players.map((m, i) => ({ clubId, competitionId, membershipId: m.id, seed: i + 1, groupLabel: null })));
  }
  const groups = format === "group_stage" ? snakeGroups(players, Math.max(1, Math.ceil(players.length / 4))) : [players];
  const rows: Array<typeof matches.$inferInsert> = [];
  groups.forEach((g, gi) => {
    const label = format === "group_stage" ? `Group ${String.fromCharCode(65 + gi)}` : "One on one";
    roundRobin(g).forEach((round, ri) => round.forEach(([a, b], si) => rows.push({ clubId, competitionId, round: label, roundOrder: ri + 1, slot: si + 1, player1Id: a.id, player2Id: b.id })));
  });
  if (rows.length) await tx.insert(matches).values(rows);
}

import { and, eq } from "drizzle-orm";
const and2 = (competitionId: string, membershipId: string) => and(eq(competitionEntries.competitionId, competitionId), eq(competitionEntries.membershipId, membershipId));
