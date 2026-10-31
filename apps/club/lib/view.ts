import type { Slot } from "@rallix/ui";
import type { MatchView } from "./queries";

/** Turn one side of a match into the UI's Slot. `scores` are that player's points per game. */
export function slotOf(m: MatchView, side: 1 | 2, rank: Map<string, number>): Slot | undefined {
  const p = side === 1 ? m.p1 : m.p2;
  if (!p) return undefined;
  const done = m.status === "completed" || m.status === "walkover";
  return {
    rank: rank.get(p.id) ?? 0, name: p.name, photo: p.photo ?? undefined,
    scores: m.games.length ? m.games.map((g) => (side === 1 ? g.p1 : g.p2)) : done ? [] : undefined,
    winner: done && m.winnerId === p.id,
  };
}
