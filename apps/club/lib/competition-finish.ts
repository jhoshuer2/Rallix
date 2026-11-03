import { and, eq } from "drizzle-orm";
import { competitionAwards, competitions, matches } from "@rallix/db";
import { awardsFromKnockout, awardsFromTable, standings } from "@rallix/stats";
import { serviceDb } from "./db";

/**
 * Called after a result is saved (the app-role checks already passed). When every match of the competition is decided it marks the
 * competition completed and records the podium. Idempotent: running it again changes nothing. Group stage finishes without awards,
 * because "the winner" of several groups is the club's call; a round robin awards its top three; a knockout awards champion,
 * runner-up and the two losing semi-finalists.
 */
export async function finishIfDone(clubId: string, competitionId: string): Promise<void> {
  await serviceDb().transaction(async (tx) => {
    const [c] = await tx.select().from(competitions).where(and(eq(competitions.id, competitionId), eq(competitions.clubId, clubId))).for("update");
    if (!c || c.status === "cancelled") return;
    const ms = await tx.select().from(matches).where(eq(matches.competitionId, competitionId));
    if (ms.length === 0 || ms.some((m) => !["completed", "walkover", "cancelled"].includes(m.status))) return;
    if (c.status !== "completed") await tx.update(competitions).set({ status: "completed" }).where(eq(competitions.id, competitionId));
    let awards: Array<{ id: string; place: 1 | 2 | 3 }> = [];
    if (c.format === "knockout") {
      awards = awardsFromKnockout(ms.map((m) => ({ round: m.roundOrder, winner: m.winnerId, p1: m.player1Id, p2: m.player2Id, bye: m.status === "walkover" && (!m.player1Id || !m.player2Id) })));
    } else if (c.format === "one_on_one" || c.format === "round_robin") {
      awards = awardsFromTable(standings(ms.map((m) => ({ p1: m.player1Id, p2: m.player2Id, winner: m.winnerId, g1: m.gamesP1, g2: m.gamesP2, done: m.status === "completed" || m.status === "walkover" })), { win: c.pointsWin, loss: c.pointsLoss }));
    }
    if (awards.length) await tx.insert(competitionAwards).values(awards.map((a) => ({ clubId, competitionId, membershipId: a.id, place: a.place }))).onConflictDoNothing();
  });
}
