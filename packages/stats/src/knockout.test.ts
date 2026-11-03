import { describe, expect, it } from "vitest";
import { advance, bracketSize, buildKnockout, drawOrder, roundName, seedPositions } from "./index";

const P = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("sizes and names", () => {
  it("rounds the bracket up to a power of two", () => {
    expect([2, 3, 4, 5, 8, 9, 16, 17, 33].map(bracketSize)).toEqual([2, 4, 4, 8, 8, 16, 16, 32, 64]);
  });
  it("names rounds from the final backwards", () => {
    expect([1, 2, 4, 8, 16].map(roundName)).toEqual(["Final", "Semi-final", "Quarter-final", "Round of 16", "Round of 32"]);
  });
  it("places seeds so 1 meets the last seed and the top two can only meet in the final", () => {
    expect(seedPositions(2)).toEqual([1, 2]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const half = (n: number) => seedPositions(16).indexOf(n) < 8 ? 0 : 1;
    expect(half(1)).not.toBe(half(2));
    expect(new Set(seedPositions(32)).size).toBe(32);
  });
});

describe("buildKnockout", () => {
  it("makes a full bracket for a power of two, with no byes", () => {
    const b = buildKnockout(P(8));
    expect(b.size).toBe(8);
    expect(b.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(b.rounds[0]!.map((m) => [m.a, m.b])).toEqual([["p1", "p8"], ["p4", "p5"], ["p2", "p7"], ["p3", "p6"]]);
    expect(b.rounds[0]!.some((m) => m.bye)).toBe(false);
    expect(b.rounds[2]![0]!.name).toBe("Final");
    expect(b.rounds[2]![0]!.feeds).toBeNull();
  });
  it("gives byes to the top seeds and already moves them into round 2", () => {
    const b = buildKnockout(P(6));
    expect(b.size).toBe(8);
    const byes = b.rounds[0]!.filter((m) => m.bye);
    expect(byes.map((m) => m.winner).sort()).toEqual(["p1", "p2"]);
    expect(b.rounds[1]![0]!.a).toBe("p1");
    expect(b.rounds[1]![1]!.a).toBe("p2");
    expect(b.rounds[1]![0]!.b).toBeNull(); // waiting for p4 v p5
  });
  it("handles 2, 3 and 5 players", () => {
    expect(buildKnockout(P(2)).rounds).toHaveLength(1);
    const three = buildKnockout(P(3));
    expect(three.rounds[0]!.filter((m) => m.bye)).toHaveLength(1);
    expect(three.rounds[1]![0]!.a).toBe("p1");
    expect(buildKnockout(P(5)).rounds[0]!.filter((m) => m.bye)).toHaveLength(3);
  });
  it("never creates a bye-vs-bye match and every player appears exactly once in round 1", () => {
    for (let n = 2; n <= 33; n++) {
      const r1 = buildKnockout(P(n)).rounds[0]!;
      expect(r1.some((m) => m.a === null && m.b === null)).toBe(false);
      expect(r1.flatMap((m) => [m.a, m.b]).filter(Boolean).sort()).toEqual(P(n).sort());
    }
  });
  it("wires feeds so two matches meet in the next round", () => {
    const b = buildKnockout(P(8));
    expect(b.rounds[0]![0]!.feeds).toEqual({ round: 2, slot: 0, side: 1 });
    expect(b.rounds[0]![1]!.feeds).toEqual({ round: 2, slot: 0, side: 2 });
    expect(b.rounds[0]![2]!.feeds).toEqual({ round: 2, slot: 1, side: 1 });
    expect(b.rounds[1]![1]!.feeds).toEqual({ round: 3, slot: 0, side: 2 });
  });
  it("refuses fewer than two players", () => {
    expect(() => buildKnockout(["x"])).toThrow();
  });
});

describe("advance", () => {
  it("moves winners up and names the champion when the final is decided", () => {
    let b = buildKnockout(P(4));
    let r = advance(b, 1, 0, "p1"); b = r.bracket; expect(r.champion).toBeNull();
    r = advance(b, 1, 1, "p3"); b = r.bracket;
    expect(b.rounds[1]![0]).toMatchObject({ a: "p1", b: "p3" });
    r = advance(b, 2, 0, "p3");
    expect(r.champion).toBe("p3");
  });
  it("does not change the input and rejects bad moves", () => {
    const b = buildKnockout(P(4));
    advance(b, 1, 0, "p1");
    expect(b.rounds[1]![0]!.a).toBeNull();
    expect(() => advance(b, 1, 0, "p2")).toThrow(); // not in that match
    expect(() => advance(b, 2, 0, "p1")).toThrow(); // opponent not known yet
    expect(() => advance(b, 9, 0, "p1")).toThrow();
  });
  it("plays out a six-player bracket to a champion", () => {
    let b = buildKnockout(P(6));
    for (const m of b.rounds[0]!.filter((x) => !x.bye)) b = advance(b, m.round, m.slot, m.a!).bracket;
    b = advance(b, 2, 0, "p1").bracket; b = advance(b, 2, 1, "p2").bracket;
    expect(advance(b, 3, 0, "p2").champion).toBe("p2");
  });
});

describe("drawOrder", () => {
  it("keeps rating order when seeded and does not mutate", () => {
    const p = P(5);
    expect(drawOrder(p, "seeded")).toEqual(p);
    expect(drawOrder(p, "seeded")).not.toBe(p);
  });
  it("shuffles for a raffle using the supplied random source, keeping everyone", () => {
    const p = P(8);
    const a = drawOrder(p, "raffle", () => 0.1), b = drawOrder(p, "raffle", () => 0.9);
    expect([...a].sort()).toEqual(p);
    expect(a).not.toEqual(b);
    expect(drawOrder(p, "raffle", () => 0.1)).toEqual(a); // same random source, same draw
  });
});
