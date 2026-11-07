import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_RULES, RULE_PRESETS, gamePointFor, isDeuce, isValidGame, presetKey, resolveMatch, rulesLabel, tieNote, validateRules, type GameRules } from "./validate";

const next: GameRules = { points: 11, winBy: 1, cap: null };
const to21: GameRules = { points: 21, winBy: 2, cap: null };
const cap15: GameRules = { points: 11, winBy: 2, cap: 15 };
const g = (p1: number, p2: number) => ({ p1, p2 });

describe("games to 11, win by two (the default, unchanged)", () => {
  it("accepts 11-0..11-9 and a lead of two after that", () => {
    for (const lo of [0, 5, 9]) expect(isValidGame(g(11, lo))).toBe(true);
    expect(isValidGame(g(12, 10))).toBe(true);
    expect(isValidGame(g(25, 23))).toBe(true);
  });
  it("refuses 11-10, 12-11, ties and short scores", () => {
    for (const x of [g(11, 10), g(12, 11), g(11, 11), g(10, 8), g(13, 10)]) expect(isValidGame(x)).toBe(false);
  });
  it("at 10-10 it is a deuce: nobody has game point until one leads", () => {
    expect(isDeuce(10, 10)).toBe(true);
    expect(gamePointFor(10, 10)).toBeNull();
    expect(gamePointFor(11, 10)).toBe(0);
    expect(gamePointFor(10, 11)).toBe(1);
    expect(gamePointFor(10, 6)).toBe(0);
    expect(gamePointFor(11, 9)).toBeNull(); // already won
  });
});

describe("games to 11, next point wins (no deuce)", () => {
  it("11-10 ends the game; 12-10 and 12-11 are not scores", () => {
    expect(isValidGame(g(11, 10), next)).toBe(true);
    expect(isValidGame(g(11, 9), next)).toBe(true);
    expect(isValidGame(g(10, 11), next)).toBe(true);
    expect(isValidGame(g(12, 10), next)).toBe(false);
    expect(isValidGame(g(12, 11), next)).toBe(false);
    expect(isValidGame(g(10, 10), next)).toBe(false);
  });
  it("at 10-10 BOTH players are on game point, and there is no deuce", () => {
    expect(gamePointFor(10, 10, next)).toBe(2);
    expect(isDeuce(10, 10, next)).toBe(false);
    expect(gamePointFor(10, 7, next)).toBe(0);
    expect(gamePointFor(6, 10, next)).toBe(1);
    expect(gamePointFor(9, 9, next)).toBeNull();
    expect(gamePointFor(11, 10, next)).toBeNull(); // won
  });
});

describe("games to 21", () => {
  it("is won at 21 with a lead of two, or by two after 20-20", () => {
    expect(isValidGame(g(21, 19), to21)).toBe(true);
    expect(isValidGame(g(21, 20), to21)).toBe(false);
    expect(isValidGame(g(22, 20), to21)).toBe(true);
    expect(isValidGame(g(11, 3), to21)).toBe(false);
  });
  it("deuce starts at 20-20", () => {
    expect(isDeuce(19, 19, to21)).toBe(false);
    expect(isDeuce(20, 20, to21)).toBe(true);
    expect(gamePointFor(20, 18, to21)).toBe(0);
  });
});

describe("a hard limit (cap 15)", () => {
  it("ends the game at 15 even by one point; before that it is win by two", () => {
    expect(isValidGame(g(15, 14), cap15)).toBe(true);
    expect(isValidGame(g(15, 13), cap15)).toBe(true);
    expect(isValidGame(g(13, 11), cap15)).toBe(true);
    expect(isValidGame(g(14, 12), cap15)).toBe(true);
    expect(isValidGame(g(16, 14), cap15)).toBe(false);
    expect(isValidGame(g(14, 13), cap15)).toBe(false);
  });
  it("at 14-14 both players are on game point", () => {
    expect(gamePointFor(14, 14, cap15)).toBe(2);
    expect(gamePointFor(13, 13, cap15)).toBeNull();
    expect(gamePointFor(12, 13, cap15)).toBe(1);
  });
});

describe("resolveMatch uses the rules and the number of games", () => {
  it("one game to 21 is a whole match", () => {
    expect(resolveMatch([g(21, 15)], 1, to21)).toMatchObject({ valid: true, winnerSide: 1, gamesP1: 1, gamesP2: 0 });
    expect(resolveMatch([g(11, 3)], 1, to21)).toMatchObject({ valid: false });
  });
  it("best of 7 needs four wins", () => {
    const six = [g(11, 5), g(5, 11), g(11, 5), g(5, 11), g(11, 5), g(5, 11)];
    expect(resolveMatch(six, 7)).toMatchObject({ valid: false });
    expect(resolveMatch([...six, g(11, 2)], 7)).toMatchObject({ valid: true, winnerSide: 1, gamesP1: 4, gamesP2: 3 });
    expect(resolveMatch([g(11, 5), g(11, 5), g(11, 5), g(11, 5), g(11, 5)], 7)).toMatchObject({ valid: false }); // recorded after it was decided
  });
  it("next point wins: 11-10 counts", () => {
    expect(resolveMatch([g(11, 10), g(10, 11), g(11, 10)], 3, next)).toMatchObject({ valid: true, winnerSide: 1 });
    expect(resolveMatch([g(12, 10)], 1, next)).toMatchObject({ valid: false });
  });
  it("a stopped game still counts under any rules", () => {
    expect(resolveMatch([{ p1: 3, p2: 0, stopped: true }], 1, to21)).toMatchObject({ valid: true, winnerSide: 1 });
  });
});

describe("validateRules", () => {
  it("accepts good choices and returns clean numbers", () => {
    expect(validateRules({ bestOf: "5", points: "11", winBy: "2" })).toEqual({ ok: true, bestOf: 5, rules: { points: 11, winBy: 2, cap: null } });
    expect(validateRules({ bestOf: 1, points: 21, winBy: 2, cap: 25 })).toEqual({ ok: true, bestOf: 1, rules: { points: 21, winBy: 2, cap: 25 } });
    expect(validateRules({ bestOf: 3, points: 15, winBy: 1 })).toMatchObject({ ok: true });
  });
  it("refuses everything else with a reason", () => {
    for (const bad of [{ bestOf: 4, points: 11, winBy: 2 }, { bestOf: 11, points: 11, winBy: 2 }, { bestOf: 5, points: 4, winBy: 2 }, { bestOf: 5, points: 31, winBy: 2 }, { bestOf: 5, points: 11, winBy: 3 }, { bestOf: 5, points: 11, winBy: 1, cap: 15 }, { bestOf: 5, points: 11, winBy: 2, cap: 11 }, { bestOf: 5, points: 11, winBy: 2, cap: 40 }, { bestOf: 5, points: 11.5, winBy: 2 }, { bestOf: "x", points: 11, winBy: 2 }]) {
      const r = validateRules(bad);
      expect(r.ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("wording", () => {
  it("the default reads exactly as the old fixed text", () => {
    expect(rulesLabel(5)).toBe("Best of 5 · first to 11, win by 2");
  });
  it("describes the other rules and the tie", () => {
    expect(rulesLabel(1, to21)).toBe("1 game · first to 21, win by 2");
    expect(rulesLabel(3, next)).toBe("Best of 3 · first to 11, next point wins at 10–10");
    expect(rulesLabel(5, cap15)).toBe("Best of 5 · first to 11, win by 2, stop at 15");
    expect(tieNote()).toBe("At 10–10 a lead of two wins, with no limit.");
    expect(tieNote(next)).toBe("At 10–10 the next point wins the game.");
    expect(tieNote(cap15)).toBe("At 10–10 a lead of two wins, up to 14–14, where the next point wins.");
    expect(tieNote(to21)).toBe("At 20–20 a lead of two wins, with no limit.");
  });
  it("presets are recognised, anything else is custom", () => {
    expect(presetKey(5, DEFAULT_GAME_RULES)).toBe("bo5-11");
    expect(presetKey(1, to21)).toBe("bo1-21");
    expect(presetKey(5, next)).toBe("custom");
    expect(RULE_PRESETS.length).toBe(4);
  });
});
