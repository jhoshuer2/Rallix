import { describe, expect, it } from "vitest";
import { applyElo, friendlyEloDelta, friendlyRecord, isRated, nextStep, validFriendlyScore, winnerOf, type ChallengeLike } from "./index";

const base: ChallengeLike = { status: "proposed", challengerId: "a", opponentId: "b", bestOf: 3, challengerRated: false, opponentRated: false, challengerGames: null, opponentGames: null, enteredBy: null };

describe("friendly scores", () => {
  it("accepts only a clean win in best of 1, 3 and 5", () => {
    expect(validFriendlyScore(3, 2, 0)).toBe(true);
    expect(validFriendlyScore(3, 1, 2)).toBe(true);
    expect(validFriendlyScore(3, 3, 0)).toBe(false);
    expect(validFriendlyScore(3, 2, 2)).toBe(false);
    expect(validFriendlyScore(3, 1, 1)).toBe(false);
    expect(validFriendlyScore(5, 3, 2)).toBe(true);
    expect(validFriendlyScore(5, 2, 2)).toBe(false);
    expect(validFriendlyScore(1, 1, 0)).toBe(true);
    expect(validFriendlyScore(4, 2, 0)).toBe(false);
    expect(validFriendlyScore(3, -1, 2)).toBe(false);
    expect(validFriendlyScore(3, 1.5, 2)).toBe(false);
  });
});

describe("rating and winner", () => {
  it("counts only when both agreed", () => {
    expect(isRated({ challengerRated: true, opponentRated: true })).toBe(true);
    expect(isRated({ challengerRated: true, opponentRated: false })).toBe(false);
    expect(isRated({ challengerRated: false, opponentRated: false })).toBe(false);
  });
  it("finds the winner from the games", () => {
    expect(winnerOf({ ...base, challengerGames: 2, opponentGames: 1 })).toBe("a");
    expect(winnerOf({ ...base, challengerGames: 0, opponentGames: 2 })).toBe("b");
    expect(winnerOf({ ...base, challengerGames: null, opponentGames: null })).toBeNull();
    expect(winnerOf({ ...base, challengerGames: 1, opponentGames: 1 })).toBeNull();
  });
  it("moves ratings by the usual Elo maths, in the right direction", () => {
    const a = friendlyEloDelta({ challenger: 1200, opponent: 1200 }, true, applyElo);
    expect(a.challenger).toBeGreaterThan(1200);
    expect(a.opponent).toBeLessThan(1200);
    expect(a.challenger + a.opponent).toBe(2400);
    const b = friendlyEloDelta({ challenger: 1200, opponent: 1200 }, false, applyElo);
    expect(b.opponent).toBeGreaterThan(1200);
    expect(b.challenger).toBeLessThan(1200);
  });
});

describe("next step", () => {
  it("gives each player one clear thing to do", () => {
    expect(nextStep(base, "b")).toBe("answer");
    expect(nextStep(base, "a")).toBe("waiting");
    expect(nextStep({ ...base, status: "accepted" }, "a")).toBe("enter");
    expect(nextStep({ ...base, status: "accepted" }, "b")).toBe("enter");
    expect(nextStep({ ...base, status: "awaiting", enteredBy: "a" }, "a")).toBe("waiting_confirm");
    expect(nextStep({ ...base, status: "awaiting", enteredBy: "a" }, "b")).toBe("confirm");
    expect(nextStep({ ...base, status: "confirmed" }, "a")).toBe("done");
    expect(nextStep({ ...base, status: "declined" }, "a")).toBe("closed");
    expect(nextStep({ ...base, status: "cancelled" }, "b")).toBe("closed");
  });
});

describe("friendly record", () => {
  it("tallies confirmed games only", () => {
    const list: ChallengeLike[] = [
      { ...base, status: "confirmed", challengerGames: 2, opponentGames: 0 },
      { ...base, status: "confirmed", challengerGames: 1, opponentGames: 2 },
      { ...base, status: "confirmed", challengerGames: 2, opponentGames: 1 },
      { ...base, status: "awaiting", challengerGames: 2, opponentGames: 0, enteredBy: "a" },
      { ...base, status: "declined" },
    ];
    expect(friendlyRecord(list, "a")).toEqual({ played: 3, won: 2, lost: 1 });
    expect(friendlyRecord(list, "b")).toEqual({ played: 3, won: 1, lost: 2 });
    expect(friendlyRecord([], "a")).toEqual({ played: 0, won: 0, lost: 0 });
  });
});
