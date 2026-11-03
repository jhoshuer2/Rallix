/** Pure rules for friendly challenges. Must agree with the SQL functions in migration 0025. */

export type ChallengeStatus = "proposed" | "accepted" | "awaiting" | "confirmed" | "declined" | "cancelled";

export interface ChallengeLike {
  status: ChallengeStatus;
  challengerId: string;
  opponentId: string;
  bestOf: number;
  challengerRated: boolean;
  opponentRated: boolean;
  challengerGames: number | null;
  opponentGames: number | null;
  enteredBy: string | null;
}

/** Games a player needs to win a best-of-N match. */
export const gamesToWin = (bestOf: number) => Math.floor(bestOf / 2) + 1;

/** A friendly score is valid when exactly one side reaches the games needed and the other has fewer. */
export function validFriendlyScore(bestOf: number, mine: number, theirs: number): boolean {
  if (![1, 3, 5].includes(bestOf)) return false;
  if (!Number.isInteger(mine) || !Number.isInteger(theirs) || mine < 0 || theirs < 0) return false;
  const need = gamesToWin(bestOf);
  return (mine === need && theirs < need) || (theirs === need && mine < need);
}

/** It counts for the ranking only when BOTH players agreed. */
export const isRated = (c: Pick<ChallengeLike, "challengerRated" | "opponentRated">) => c.challengerRated && c.opponentRated;

export function winnerOf(c: Pick<ChallengeLike, "challengerId" | "opponentId" | "challengerGames" | "opponentGames">): string | null {
  if (c.challengerGames == null || c.opponentGames == null || c.challengerGames === c.opponentGames) return null;
  return c.challengerGames > c.opponentGames ? c.challengerId : c.opponentId;
}

export type NextStep = "answer" | "waiting" | "enter" | "confirm" | "waiting_confirm" | "done" | "closed";

/** What the signed-in player should see on a challenge: one clear next step. */
export function nextStep(c: ChallengeLike, me: string): NextStep {
  switch (c.status) {
    case "proposed": return c.opponentId === me ? "answer" : "waiting";
    case "accepted": return "enter";
    case "awaiting": return c.enteredBy === me ? "waiting_confirm" : "confirm";
    case "confirmed": return "done";
    default: return "closed";
  }
}

/** Win/loss tally over confirmed friendlies, from one player's point of view. */
export function friendlyRecord(list: ChallengeLike[], me: string): { played: number; won: number; lost: number } {
  let won = 0, lost = 0;
  for (const c of list) {
    if (c.status !== "confirmed") continue;
    const w = winnerOf(c);
    if (!w) continue;
    if (w === me) won++; else lost++;
  }
  return { played: won + lost, won, lost };
}

/** Elo for a confirmed, mutually-rated friendly. Reuses the same maths as competitions. */
export function friendlyEloDelta(before: { challenger: number; opponent: number }, challengerWon: boolean, apply: (w: number, l: number) => { winner: number; loser: number }) {
  const r = challengerWon ? apply(before.challenger, before.opponent) : apply(before.opponent, before.challenger);
  return challengerWon
    ? { challenger: r.winner, opponent: r.loser }
    : { challenger: r.loser, opponent: r.winner };
}
