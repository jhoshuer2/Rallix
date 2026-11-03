import { describe, expect, it } from "vitest";
import { applyElo, computeRecord, expectedScore, headToHead, gamePointFor, isDeuce, isValidGame, isValidStoppedGame, resolveMatch, roundRobin, shuffle, snakeGroups, streakLabel, type PlayedMatch } from "./index";

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

import { celebrations } from "./celebrations";
describe("celebrations", () => {
  const m = (id: string, dob: string | null, joined: string) => ({ id, name: id, dob, joinedAt: joined });
  it("labels a birthday today, tomorrow, yesterday and further out, soonest first", () => {
    const out = celebrations([m("a", "1990-11-01", "2026-01-01"), m("b", "1990-11-02", "2026-01-01"), m("c", "1990-10-31", "2026-01-01"), m("d", "1990-11-05", "2026-01-01"), m("e", "1990-10-25", "2026-01-01")], "2026-11-01");
    expect(out.filter((c) => c.kind === "birthday").map((c) => [c.name, c.label])).toEqual([["a", "Birthday today"], ["b", "Birthday tomorrow"], ["d", "Birthday in 4 days"], ["c", "Birthday yesterday"], ["e", "Birthday 7 days ago"]]);
  });
  it("ignores birthdays outside the window and members with no birthday", () => {
    expect(celebrations([m("a", "1990-11-20", "2026-01-01"), m("b", null, "2026-01-01")], "2026-11-01")).toEqual([]);
  });
  it("works across New Year", () => {
    const out = celebrations([m("a", "1990-01-02", "2020-06-15"), m("b", "1990-12-30", "2020-06-15")], "2026-12-31");
    expect(out.map((c) => c.label)).toEqual(["Birthday in 2 days", "Birthday yesterday"]);
  });
  it("treats 29 February as 28 February in a non-leap year", () => {
    expect(celebrations([m("a", "1992-02-29", "2020-06-15")], "2027-02-28").map((c) => c.label)).toEqual(["Birthday today"]);
  });
  it("shows club anniversaries from one year up, and new members in their first week", () => {
    const out = celebrations([m("a", null, "2024-11-02"), m("b", null, "2026-10-30"), m("c", null, "2026-11-01"), m("d", null, "2025-06-01")], "2026-11-01");
    expect(out.map((c) => [c.name, c.kind, c.label])).toEqual([["c", "new", "Joined today"], ["a", "anniversary", "2-year anniversary tomorrow"], ["b", "new", "New in the club"]]);
  });
  it("never exposes age and never throws on bad dates", () => {
    const out = celebrations([m("a", "not-a-date", "2020-01-01"), m("b", "1990-11-01", "2020-01-01")], "2026-11-01");
    expect(JSON.stringify(out)).not.toMatch(/1990|age/);
  });
});
describe("celebrations ordering", () => {
  it("puts a birthday before an anniversary before a new member on the same day", () => {
    const out = celebrations([{ id: "n", name: "A new", joinedAt: "2026-11-01" }, { id: "b", name: "Z bday", dob: "1990-11-01", joinedAt: "2026-01-01" }, { id: "a", name: "M anniv", joinedAt: "2025-11-01" }], "2026-11-01");
    expect(out.map((c) => c.kind)).toEqual(["birthday", "anniversary", "new"]);
  });
});

import { celebrationTiles, type Celebration } from "./celebrations";
describe("celebrationTiles", () => {
  const c = (id: string, kind: Celebration["kind"], off = 0): Celebration => ({ id: `${kind[0]}-${id}`, memberId: id, name: `Name ${id}`, photo: null, kind, label: kind, offsetDays: off });
  it("shows a few new members one by one", () => {
    const t = celebrationTiles([c("1", "new"), c("2", "new"), c("3", "new")]);
    expect(t.map((x) => x.type)).toEqual(["person", "person", "person"]);
  });
  it("collapses many new members into one tile with three faces", () => {
    const t = celebrationTiles(Array.from({ length: 100 }, (_, i) => c(String(i), "new")));
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ type: "group", count: 100, label: "100 new players" });
    expect((t[0] as { faces: unknown[] }).faces).toHaveLength(3);
  });
  it("keeps birthdays visible and in order ahead of a joiner flood", () => {
    const items = [c("b1", "birthday"), c("b2", "birthday", 1), ...Array.from({ length: 50 }, (_, i) => c(`n${i}`, "new"))];
    const t = celebrationTiles(items);
    expect(t.map((x) => x.type)).toEqual(["person", "person", "group"]);
    expect((t[0] as { kind: string }).kind).toBe("birthday");
  });
  it("caps the strip and counts everyone it hides", () => {
    const t = celebrationTiles(Array.from({ length: 12 }, (_, i) => c(String(i), "birthday")), { max: 8 });
    expect(t).toHaveLength(8);
    expect(t[7]).toMatchObject({ type: "more", count: 5, label: "+5 more" });
  });
  it("returns nothing when there is nothing", () => expect(celebrationTiles([])).toEqual([]));
  it("keeps the group tile visible when many birthdays compete for room", () => {
    const items = [...Array.from({ length: 9 }, (_, i) => c(`b${i}`, "birthday")), ...Array.from({ length: 20 }, (_, i) => c(`n${i}`, "new"))];
    const t = celebrationTiles(items, { max: 8 });
    expect(t).toHaveLength(8);
    expect(t.slice(0, 6).every((x) => x.type === "person")).toBe(true);
    expect(t[6]).toMatchObject({ type: "group", count: 20 });
    expect(t[7]).toMatchObject({ type: "more", count: 3 });
  });
  it("shows the group and no more tile when the birthdays fit beside it", () => {
    const items = [...Array.from({ length: 6 }, (_, i) => c(`b${i}`, "birthday")), ...Array.from({ length: 9 }, (_, i) => c(`n${i}`, "new"))];
    const t = celebrationTiles(items, { max: 8 });
    expect(t.map((x) => x.type)).toEqual(["person", "person", "person", "person", "person", "person", "group"]);
  });
});

describe("stopped games, game point and deuce", () => {
  it("lets the umpire stop a game where someone leads, but never a tie", () => {
    expect(isValidStoppedGame({ p1: 7, p2: 5, stopped: true })).toBe(true);
    expect(isValidStoppedGame({ p1: 0, p2: 3, stopped: true })).toBe(true);
    expect(isValidStoppedGame({ p1: 5, p2: 5, stopped: true })).toBe(false);
    expect(isValidStoppedGame({ p1: -1, p2: 5, stopped: true })).toBe(false);
    expect(isValidStoppedGame({ p1: 2.5, p2: 1, stopped: true })).toBe(false);
    expect(isValidStoppedGame({ p1: 100, p2: 1, stopped: true })).toBe(false);
  });
  it("counts a stopped game in the match, and an ordinary invalid game still fails", () => {
    const full = [{ p1: 11, p2: 3 }, { p1: 3, p2: 2, stopped: true }, { p1: 11, p2: 9 }];
    expect(resolveMatch(full, 5)).toMatchObject({ valid: true, winnerSide: 1, gamesP1: 3, gamesP2: 0 });
    expect(resolveMatch([{ p1: 11, p2: 3 }, { p1: 7, p2: 5 }, { p1: 11, p2: 9 }], 5)).toMatchObject({ valid: false }); // 7-5 was not stopped
    expect(resolveMatch([{ p1: 5, p2: 5, stopped: true }], 3)).toMatchObject({ valid: false });
    expect(resolveMatch([{ p1: 11, p2: 0 }, { p1: 4, p2: 6, stopped: true }, { p1: 8, p2: 11 }], 3)).toMatchObject({ valid: true, winnerSide: 2, gamesP1: 1, gamesP2: 2 });
  });
  it("knows game point and deuce, with no upper limit in a deuce", () => {
    expect(gamePointFor(10, 8)).toBe(0);
    expect(gamePointFor(9, 10)).toBe(1);
    expect(gamePointFor(10, 10)).toBeNull();
    expect(gamePointFor(11, 10)).toBe(0); // one point from winning by two
    expect(gamePointFor(12, 10)).toBeNull(); // that is a finished game
    expect(gamePointFor(9, 5)).toBeNull();
    expect(isDeuce(10, 10)).toBe(true);
    expect(isDeuce(10, 9)).toBe(false);
    expect(isValidGame({ p1: 24, p2: 22 })).toBe(true);
    expect(isValidGame({ p1: 24, p2: 23 })).toBe(false);
  });
});
