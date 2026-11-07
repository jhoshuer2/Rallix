import { eq } from "drizzle-orm";
import { clubs, type Tx } from "@rallix/db";
import { DEFAULT_GAME_RULES, type GameRules } from "@rallix/stats";

/** How many games make a match, and what decides a game. */
export type RuleSet = { bestOf: number; rules: GameRules };

type Row = { bestOf: number; gamePoints: number; winBy: number; pointCap: number | null };
const winBy = (n: number): 1 | 2 => (n === 1 ? 1 : 2);

/** Rules stored on a match or a competition row. */
export const ruleSetOf = (r: Row): RuleSet => ({ bestOf: r.bestOf, rules: { points: r.gamePoints, winBy: winBy(r.winBy), cap: r.pointCap } });

/** The column values for a match or competition. */
export const ruleColumns = (s: RuleSet) => ({ bestOf: s.bestOf, gamePoints: s.rules.points, winBy: s.rules.winBy, pointCap: s.rules.cap });

/** The club's usual rules (what a new competition starts with). RLS lets every member read them. */
export async function clubRules(tx: Tx, clubId: string): Promise<RuleSet> {
  const [c] = await tx.select({ bestOf: clubs.defaultBestOf, gamePoints: clubs.defaultGamePoints, winBy: clubs.defaultWinBy, pointCap: clubs.defaultPointCap }).from(clubs).where(eq(clubs.id, clubId)).limit(1);
  return c ? ruleSetOf(c) : { bestOf: 5, rules: DEFAULT_GAME_RULES };
}
