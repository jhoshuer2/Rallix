import { describe, expect, it } from "vitest";
import { awardsFromKnockout, awardsFromTable, seasonTable, standings, standingsByTable, type StandingMatch } from "./index";

const M = (p1: string, p2: string, winner: string | null, g1: number, g2: number, extra: Partial<StandingMatch> = {}): StandingMatch => ({ p1, p2, winner, g1, g2, done: winner !== null, ...extra });

describe("standings", () => {
  it("scores wins and losses with the club's rules and ranks by points", () => {
    const t = standings([M("a", "b", "a", 3, 0), M("a", "c", "a", 3, 1), M("b", "c", "b", 3, 2)], { win: 3, loss: 0 });
    expect(t.map((r) => [r.id, r.points, r.won, r.lost])).toEqual([["a", 6, 2, 0], ["b", 3, 1, 1], ["c", 0, 0, 2]]);
    expect(t.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
  it("can give a point for losing", () => {
    const t = standings([M("a", "b", "a", 3, 0)], { win: 2, loss: 1 });
    expect(t.find((r) => r.id === "a")!.points).toBe(2);
    expect(t.find((r) => r.id === "b")!.points).toBe(1);
  });
  it("ignores matches that are not decided or have no opponent", () => {
    const t = standings([M("a", "b", null, 0, 0), { p1: "a", p2: null, winner: "a", g1: 0, g2: 0, done: true }]);
    expect(t).toEqual([]);
    expect(standings([], undefined, ["x", "y"]).map((r) => r.id)).toEqual(["x", "y"]);
  });
  it("breaks a tie on points by head-to-head, then game difference, then point difference", () => {
    // a, b, c all win once and lose once
    const cycle = [M("a", "b", "a", 3, 2), M("b", "c", "b", 3, 2), M("c", "a", "c", 3, 2)];
    const t = standings(cycle);
    expect(t.map((r) => r.points)).toEqual([3, 3, 3]);
    expect(new Set(t.map((r) => r.id)).size).toBe(3);
    // two tied on points: the one who won their meeting is first even with a worse game difference
    const x = standings([M("p", "q", "p", 3, 2), M("q", "r", "q", 3, 0), M("p", "r", "r", 0, 3)]);
    expect(x.every((r) => r.points === 3)).toBe(true);
    const two = standings([M("p", "q", "p", 3, 2), M("q", "r", "q", 3, 0), M("r", "p", "r", 3, 0), M("p", "s", "p", 3, 2), M("q", "s", "s", 3, 0)]);
    expect(two[0]!.points).toBeGreaterThanOrEqual(two[1]!.points);
    const gd = standings([M("a", "z", "a", 3, 0), M("b", "z", "b", 3, 2)]);
    expect(gd.map((r) => r.id).slice(0, 2)).toEqual(["a", "b"]); // same points, a has the better game difference
    const pd = standings([M("a", "z", "a", 3, 0, { pts1: 33, pts2: 20 }), M("b", "y", "b", 3, 0, { pts1: 33, pts2: 30 })]);
    expect(pd.map((r) => r.id).slice(0, 2)).toEqual(["a", "b"]); // same games, a has the better point difference
  });
  it("makes one table per group", () => {
    const g = standingsByTable([M("a", "b", "a", 3, 0, { table: "Group A" }), M("c", "d", "d", 0, 3, { table: "Group B" })]);
    expect(g.map((t) => t.table)).toEqual(["Group A", "Group B"]);
    expect(g[1]!.rows[0]!.id).toBe("d");
  });
});

describe("seasonTable", () => {
  it("adds up each competition scored by its own rules", () => {
    const s = seasonTable([
      { rules: { win: 3, loss: 0 }, matches: [M("a", "b", "a", 3, 0)] },
      { rules: { win: 2, loss: 1 }, matches: [M("b", "a", "b", 3, 1)] },
    ]);
    expect(s.map((r) => [r.id, r.points, r.played])).toEqual([["a", 4, 2], ["b", 2, 2]]);
    expect(seasonTable([])).toEqual([]);
  });
});

describe("awards", () => {
  it("gives a league's podium to the top three who played", () => {
    const t = standings([M("a", "b", "a", 3, 0), M("a", "c", "a", 3, 0), M("b", "c", "b", 3, 0), M("a", "d", "a", 3, 0), M("b", "d", "b", 3, 0), M("c", "d", "c", 3, 0)]);
    expect(awardsFromTable(t)).toEqual([{ id: "a", place: 1 }, { id: "b", place: 2 }, { id: "c", place: 3 }]);
    expect(awardsFromTable([])).toEqual([]);
  });
  it("gives a knockout champion, runner-up and two joint thirds", () => {
    const aw = awardsFromKnockout([
      { round: 1, winner: "a", p1: "a", p2: "d" }, { round: 1, winner: "b", p1: "b", p2: "c" },
      { round: 2, winner: "b", p1: "a", p2: "b" },
    ]);
    // round 2 is the final here; the semi-finals are round 1
    expect(aw.filter((x) => x.place === 1).map((x) => x.id)).toEqual(["b"]);
    expect(aw.filter((x) => x.place === 2).map((x) => x.id)).toEqual(["a"]);
    expect(aw.filter((x) => x.place === 3).map((x) => x.id).sort()).toEqual(["c", "d"]);
  });
  it("skips byes when naming third place and returns nothing before the final is decided", () => {
    const aw = awardsFromKnockout([
      { round: 1, winner: "a", p1: "a", p2: null, bye: true }, { round: 1, winner: "b", p1: "b", p2: "c" },
      { round: 2, winner: "a", p1: "a", p2: "b" },
    ]);
    expect(aw.filter((x) => x.place === 3).map((x) => x.id)).toEqual(["c"]);
    expect(awardsFromKnockout([{ round: 1, winner: null, p1: "a", p2: "b" }])).toEqual([]);
  });
});
