import type { GameScore } from "./record";

/**
 * What decides a game in this club. `points` is the target (11, 21...). `winBy` 2 means a game is won by leading by two once both
 * players are one short of the target (deuce goes on); `winBy` 1 means the next point wins: first to the target, so at 10-10 in a
 * game to 11 the very next point wins. `cap` is an optional hard limit for win-by-two games (at 14-14 with cap 15 the next point wins).
 */
export type GameRules = { points: number; winBy: 1 | 2; cap: number | null };
export const DEFAULT_GAME_RULES: GameRules = { points: 11, winBy: 2, cap: null };
export const BEST_OF_CHOICES = [1, 3, 5, 7, 9] as const;

/** A finished game under these rules. */
export function isValidGame(g: GameScore, rules: GameRules = DEFAULT_GAME_RULES): boolean {
  const { points, winBy, cap } = rules;
  const hi = Math.max(g.p1, g.p2), lo = Math.min(g.p1, g.p2);
  if (!Number.isInteger(g.p1) || !Number.isInteger(g.p2) || lo < 0) return false;
  if (hi < points || g.p1 === g.p2) return false;
  if (winBy === 1) return hi === points; // the next point after the target never happens
  if (cap !== null && hi === cap) return lo === cap - 1 || lo === cap - 2; // the hard limit ends a game even one point apart
  if (cap !== null && hi > cap) return false;
  return hi === points ? lo <= points - 2 : hi - lo === 2;
}

/**
 * The umpire stopped a game before it reached its natural end (time, injury, a dispute). Whoever leads wins that game.
 * A tie cannot be stopped, and the score must be a real score (whole numbers, not absurd).
 */
export function isValidStoppedGame(g: GameScore): boolean {
  if (!Number.isInteger(g.p1) || !Number.isInteger(g.p2) || g.p1 < 0 || g.p2 < 0 || g.p1 > 99 || g.p2 > 99) return false;
  return g.p1 !== g.p2;
}

/**
 * Who has game point right now: 0 (first player), 1 (second), 2 (BOTH: the next point wins whoever gets it) or null.
 * In a win-by-two deuce the player one ahead has it; with "next point wins" a tie one short of the target gives it to both.
 */
export function gamePointFor(p1: number, p2: number, rules: GameRules = DEFAULT_GAME_RULES): 0 | 1 | 2 | null {
  if (isValidGame({ p1, p2 }, rules)) return null; // already won
  const { points, winBy, cap } = rules;
  const edge = points - 1;
  if (winBy === 1) return p1 === edge && p2 === edge ? 2 : p1 === edge ? 0 : p2 === edge ? 1 : null;
  if (cap !== null && p1 === cap - 1 && p2 === cap - 1) return 2;
  if (p1 >= edge && p1 > p2) return 0;
  if (p2 >= edge && p2 > p1) return 1;
  return null;
}

/** Both players are one short of the target: from here a win-by-two game is decided by a lead of two (unless a cap ends it). */
export const isDeuce = (p1: number, p2: number, rules: GameRules = DEFAULT_GAME_RULES) => rules.winBy === 2 && p1 >= rules.points - 1 && p2 >= rules.points - 1;

export type MatchOutcome = { valid: true; winnerSide: 1 | 2; gamesP1: number; gamesP2: number } | { valid: false; reason: string };

/** Validate a finished best-of-N match: every game legal and the match ends exactly when someone reaches the majority. */
export function resolveMatch(games: GameScore[], bestOf: number, rules: GameRules = DEFAULT_GAME_RULES): MatchOutcome {
  const need = Math.floor(bestOf / 2) + 1;
  let a = 0, b = 0;
  for (let i = 0; i < games.length; i++) {
    const g = games[i]!;
    if (!(isValidGame(g, rules) || (g.stopped === true && isValidStoppedGame(g)))) return { valid: false, reason: `Game ${i + 1} is not a valid score` };
    if (a >= need || b >= need) return { valid: false, reason: "Games were recorded after the match was decided" };
    if (g.p1 > g.p2) a++; else b++;
  }
  if (a < need && b < need) return { valid: false, reason: "The match is not finished yet" };
  return { valid: true, winnerSide: a > b ? 1 : 2, gamesP1: a, gamesP2: b };
}

/** What an admin may choose. Returns the clean rules, or a plain-words problem. */
export function validateRules(input: { bestOf: unknown; points: unknown; winBy: unknown; cap?: unknown }): { ok: true; bestOf: number; rules: GameRules } | { ok: false; error: string } {
  const bestOf = Number(input.bestOf), points = Number(input.points), winBy = Number(input.winBy);
  const cap = input.cap === null || input.cap === undefined || input.cap === "" ? null : Number(input.cap);
  if (!(BEST_OF_CHOICES as readonly number[]).includes(bestOf)) return { ok: false, error: "Choose 1, 3, 5, 7 or 9 games." };
  if (!Number.isInteger(points) || points < 5 || points > 30) return { ok: false, error: "Points to win a game must be between 5 and 30." };
  if (winBy !== 1 && winBy !== 2) return { ok: false, error: "Choose win by two points, or next point wins." };
  if (cap !== null) {
    if (winBy !== 2) return { ok: false, error: "A stop-at limit only applies when a game is won by two points." };
    if (!Number.isInteger(cap) || cap <= points || cap > points + 20) return { ok: false, error: `The limit must be above ${points} and at most ${points + 20}.` };
  }
  return { ok: true, bestOf, rules: { points, winBy: winBy as 1 | 2, cap } };
}

/** "Best of 5 · first to 11, win by 2": identical to the old fixed text for the default rules. */
export function rulesLabel(bestOf: number, rules: GameRules = DEFAULT_GAME_RULES): string {
  const games = bestOf === 1 ? "1 game" : `Best of ${bestOf}`;
  const how = rules.winBy === 2 ? "win by 2" : "next point wins at " + `${rules.points - 1}–${rules.points - 1}`;
  const cap = rules.cap !== null && rules.winBy === 2 ? `, stop at ${rules.cap}` : "";
  return `${games} · first to ${rules.points}, ${how}${cap}`;
}

/** One plain sentence about the tie, for the scoring screen and the picker. */
export function tieNote(rules: GameRules = DEFAULT_GAME_RULES): string {
  const t = rules.points - 1;
  if (rules.winBy === 1) return `At ${t}–${t} the next point wins the game.`;
  if (rules.cap !== null) return `At ${t}–${t} a lead of two wins, up to ${rules.cap - 1}–${rules.cap - 1}, where the next point wins.`;
  return `At ${t}–${t} a lead of two wins, with no limit.`;
}

/** The quick choices. Custom lets the admin pick every part. */
export const RULE_PRESETS: Array<{ key: string; label: string; bestOf: number; rules: GameRules }> = [
  { key: "bo3-11", label: "Best of 3, to 11", bestOf: 3, rules: DEFAULT_GAME_RULES },
  { key: "bo5-11", label: "Best of 5, to 11", bestOf: 5, rules: DEFAULT_GAME_RULES },
  { key: "bo7-11", label: "Best of 7, to 11", bestOf: 7, rules: DEFAULT_GAME_RULES },
  { key: "bo1-21", label: "1 game, to 21", bestOf: 1, rules: { points: 21, winBy: 2, cap: null } },
];
export const presetKey = (bestOf: number, rules: GameRules): string => RULE_PRESETS.find((p) => p.bestOf === bestOf && p.rules.points === rules.points && p.rules.winBy === rules.winBy && p.rules.cap === rules.cap)?.key ?? "custom";
