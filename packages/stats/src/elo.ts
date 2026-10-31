export const START_RATING = 1200;
export const K_FACTOR = 32;

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

/** Standard Elo. Returns new integer ratings for the winner and the loser. */
export function applyElo(winner: number, loser: number, k = K_FACTOR): { winner: number; loser: number } {
  const ew = expectedScore(winner, loser);
  const delta = k * (1 - ew);
  return { winner: Math.round(winner + delta), loser: Math.round(loser - delta) };
}
