import type { GameScore } from "./record";

/** A table tennis game: first to 11, win by 2 (so 12-10, 14-12 ...). */
export function isValidGame(g: GameScore): boolean {
  const hi = Math.max(g.p1, g.p2), lo = Math.min(g.p1, g.p2);
  if (!Number.isInteger(g.p1) || !Number.isInteger(g.p2) || lo < 0) return false;
  if (hi < 11 || g.p1 === g.p2) return false;
  return hi === 11 ? lo <= 9 : hi - lo === 2;
}

export type MatchOutcome = { valid: true; winnerSide: 1 | 2; gamesP1: number; gamesP2: number } | { valid: false; reason: string };

/** Validate a finished best-of-N match: every game legal and the match ends exactly when someone reaches the majority. */
export function resolveMatch(games: GameScore[], bestOf: number): MatchOutcome {
  const need = Math.floor(bestOf / 2) + 1;
  let a = 0, b = 0;
  for (let i = 0; i < games.length; i++) {
    const g = games[i]!;
    if (!isValidGame(g)) return { valid: false, reason: `Game ${i + 1} is not a valid score` };
    if (a >= need || b >= need) return { valid: false, reason: "Games were recorded after the match was decided" };
    if (g.p1 > g.p2) a++; else b++;
  }
  if (a < need && b < need) return { valid: false, reason: "The match is not finished yet" };
  return { valid: true, winnerSide: a > b ? 1 : 2, gamesP1: a, gamesP2: b };
}
