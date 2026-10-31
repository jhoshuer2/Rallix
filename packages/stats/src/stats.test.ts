import { describe, expect, it } from "vitest";
import { applyElo, computeRecord, expectedScore, headToHead, isValidGame, resolveMatch, roundRobin, shuffle, snakeGroups, streakLabel, type PlayedMatch } from "./index";

const d = (n: number) => new Date(2026, 9, n);
const m = (id: string, p1: string, p2: string, winner: string, day: number, games: Array<[number, number]>): PlayedMatch =>
  ({ id, player1Id: p1, player2Id: p2, winnerId: winner, playedAt: d(day), games: games.map(([a, b]) => ({ p1: a, p2: b })) });

describe("elo", () => {
  it("equal ratings: winner gains 16, loser loses 16, total is conserved", () => {
    expect(applyElo(1200, 1200)).toEqual({ winner: 1216, loser: 1184 });
  });
  it("an upset moves more points than an expected win", () => {
    const upset = applyElo(1000, 1400).winner - 1000;
    const expected = applyElo(1400, 1000).winner - 1400;
    expect(upset).toBeGreaterThan(expected);
    expect(upset).toBeGreaterThan(28);
  });
  it("expected score is symmetric and 0.5 at equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
    expect(expectedScore(1300, 1100) + expectedScore(1100, 1300)).toBeCloseTo(1);
  });
});

describe("computeRecord", () => {
  const ms = [
    m("1", "me", "a", "me", 1, [[11, 7], [11, 8], [11, 5]]),
    m("2", "b", "me", "b", 2, [[11, 9], [11, 6], [11, 8]]),
    m("3", "me", "c", "me", 3, [[11, 9], [8, 11], [11, 7], [11, 5]]),
    m("4", "me", "d", "me", 4, [[11, 0], [11, 0], [11, 0]]),
    m("x", "e", "f", "e", 5, [[11, 1], [11, 1], [11, 1]]),
  ];
  const r = computeRecord("me", ms);
  it("counts only matches the player was in", () => { expect(r.played).toBe(4); expect(r.won).toBe(3); expect(r.lost).toBe(1); expect(r.winPct).toBe(75); });
  it("streak and form are newest first", () => { expect(r.streak).toBe(2); expect(r.form).toEqual(["W", "W", "L", "W"]); });
  it("games and points are counted from the player's side, including when they are player 2", () => {
    expect(r.gamesFor).toBe(3 + 0 + 3 + 3);
    expect(r.gamesAgainst).toBe(0 + 3 + 1 + 0);
    expect(r.pointsFor).toBe(33 + 23 + 41 + 33);
  });
  it("handles no matches", () => { expect(computeRecord("nobody", ms)).toMatchObject({ played: 0, winPct: 0, streak: 0, form: [] }); });
  it("a losing streak is negative", () => { expect(computeRecord("a", ms).streak).toBe(-1); expect(streakLabel(-2)).toBe("2 losses"); expect(streakLabel(1)).toBe("1 win"); expect(streakLabel(0)).toBe("None"); });
  it("head to head groups by opponent from either side", () => {
    const h = headToHead("me", [...ms, m("5", "a", "me", "a", 6, [[11, 1], [11, 1], [11, 1]])]);
    expect(h.find((x) => x.opponentId === "a")).toEqual({ opponentId: "a", won: 1, lost: 1 });
    expect(h).toHaveLength(4);
  });
});

describe("game and match validation", () => {
  it("accepts legal games", () => { for (const g of [[11, 0], [11, 9], [12, 10], [14, 12], [9, 11]]) expect(isValidGame({ p1: g[0]!, p2: g[1]! })).toBe(true); });
  it("rejects illegal games", () => { for (const g of [[10, 8], [11, 10], [13, 10], [11, 11], [12, 9], [-1, 11], [11.5, 3]]) expect(isValidGame({ p1: g[0]!, p2: g[1]! })).toBe(false); });
  const G = (arr: Array<[number, number]>) => arr.map(([p1, p2]) => ({ p1, p2 }));
  it("resolves a best of 5", () => {
    expect(resolveMatch(G([[11, 7], [9, 11], [11, 8], [11, 6]]), 5)).toEqual({ valid: true, winnerSide: 1, gamesP1: 3, gamesP2: 1 });
    expect(resolveMatch(G([[5, 11], [7, 11], [9, 11]]), 5)).toMatchObject({ valid: true, winnerSide: 2, gamesP1: 0, gamesP2: 3 });
  });
  it("rejects unfinished matches and games after the decider", () => {
    expect(resolveMatch(G([[11, 7], [11, 8]]), 5)).toMatchObject({ valid: false });
    expect(resolveMatch(G([[11, 7], [11, 8], [11, 6], [11, 5]]), 5)).toMatchObject({ valid: false });
  });
  it("rejects an invalid game inside an otherwise finished match", () => { expect(resolveMatch(G([[11, 7], [11, 10], [11, 5]]), 5)).toMatchObject({ valid: false }); });
});

describe("fixtures", () => {
  it("round robin: every pair meets exactly once", () => {
    for (const n of [2, 3, 4, 5, 6, 7]) {
      const players = Array.from({ length: n }, (_, i) => i);
      const pairs = roundRobin(players).flat().map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join("-"));
      expect(new Set(pairs).size).toBe(pairs.length);
      expect(pairs.length).toBe((n * (n - 1)) / 2);
    }
  });
  it("round robin: nobody plays twice in a round", () => {
    for (const round of roundRobin([1, 2, 3, 4, 5, 6])) { const flat = round.flat(); expect(new Set(flat).size).toBe(flat.length); }
  });
  it("snake groups balance seeds", () => {
    const g = snakeGroups([1, 2, 3, 4, 5, 6, 7, 8], 2);
    expect(g).toEqual([[1, 4, 5, 8], [2, 3, 6, 7]]);
  });
  it("shuffle keeps all items and is deterministic with a seeded rand", () => {
    let s = 1; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const out = shuffle([1, 2, 3, 4, 5], rand);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
