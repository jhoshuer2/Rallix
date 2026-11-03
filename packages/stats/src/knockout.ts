import { shuffle } from "./fixtures";

/** Pure single-elimination bracket rules. Players come in seed order (best first); seeds above the player count are byes. */

export type DrawMethod = "seeded" | "raffle";

/** The order players take their seeds: by rating as given, or a random draw (injectable so it can be tested). */
export function drawOrder<T>(players: T[], method: DrawMethod, rand: () => number = Math.random): T[] {
  return method === "raffle" ? shuffle(players, rand) : [...players];
}

/** Smallest power of two that holds `n` players. */
export function bracketSize(n: number): number {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}

/** Seed numbers in bracket order (adjacent pairs meet in round 1). 1 meets the last seed, and the top seeds can only meet late. */
export function seedPositions(size: number): number[] {
  let order = [1];
  while (order.length < size) { const n = order.length * 2; order = order.flatMap((s) => [s, n + 1 - s]); }
  return order;
}

export function roundName(matchesInRound: number): string {
  if (matchesInRound === 1) return "Final";
  if (matchesInRound === 2) return "Semi-final";
  if (matchesInRound === 4) return "Quarter-final";
  return `Round of ${matchesInRound * 2}`;
}

export interface KoMatch<T> {
  round: number; // 1 = first round
  slot: number; // 0-based position in the round
  name: string;
  a: T | null;
  b: T | null;
  /** Round 1 only: one side is a bye, so the other advances without playing. */
  bye: boolean;
  winner: T | null;
  /** Where the winner goes next (null for the final). */
  feeds: { round: number; slot: number; side: 1 | 2 } | null;
}
export interface Bracket<T> { size: number; rounds: Array<Array<KoMatch<T>>> }

/** Build the whole bracket. Byes go to the top seeds and are already advanced into round 2. */
export function buildKnockout<T>(players: T[]): Bracket<T> {
  if (players.length < 2) throw new Error("a knockout needs at least 2 players");
  const size = bracketSize(players.length);
  const order = seedPositions(size);
  const at = (seed: number): T | null => players[seed - 1] ?? null;
  const roundsCount = Math.log2(size);
  const rounds: Array<Array<KoMatch<T>>> = [];
  for (let r = 1; r <= roundsCount; r++) {
    const count = size / 2 ** r;
    rounds.push(Array.from({ length: count }, (_, k) => ({
      round: r, slot: k, name: roundName(count), a: null, b: null, bye: false, winner: null,
      feeds: r < roundsCount ? { round: r + 1, slot: Math.floor(k / 2), side: (k % 2 === 0 ? 1 : 2) as 1 | 2 } : null,
    })));
  }
  rounds[0]!.forEach((m, k) => {
    m.a = at(order[2 * k]!); m.b = at(order[2 * k + 1]!);
    if (m.a === null || m.b === null) { m.bye = true; m.winner = m.a ?? m.b; }
  });
  for (const m of rounds[0]!) if (m.bye && m.winner) put(rounds, m, m.winner);
  return { size, rounds };
}

function put<T>(rounds: Array<Array<KoMatch<T>>>, from: KoMatch<T>, player: T) {
  if (!from.feeds) return;
  const next = rounds[from.feeds.round - 1]![from.feeds.slot]!;
  if (from.feeds.side === 1) next.a = player; else next.b = player;
}

/** Record a winner and move them into the next match. Returns the champion when the final was decided. Mutates a copy, not the input. */
export function advance<T>(bracket: Bracket<T>, round: number, slot: number, winner: T): { bracket: Bracket<T>; champion: T | null } {
  const rounds = bracket.rounds.map((r) => r.map((m) => ({ ...m })));
  const m = rounds[round - 1]?.[slot];
  if (!m) throw new Error("no such match");
  if (m.a === null || m.b === null) throw new Error("the match has no opponent yet");
  if (winner !== m.a && winner !== m.b) throw new Error("the winner must be one of the two players");
  m.winner = winner;
  put(rounds, m, winner);
  return { bracket: { size: bracket.size, rounds }, champion: m.feeds ? null : winner };
}
