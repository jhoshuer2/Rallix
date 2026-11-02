import { describe, expect, it } from "vitest";
import { registrationState, spotsLabel, spotsPercent, visibleToPlayers, type RegistrationInput } from "./registration";

const base: RegistrationInput = { status: "draft", openRegistration: true, maxPlayers: 4, entries: 1, closesOn: "2026-11-10", today: "2026-11-05", registered: false, level: null, myLevel: "junior" };
const s = (o: Partial<RegistrationInput>) => registrationState({ ...base, ...o });

describe("registrationState", () => {
  it("lets an eligible player join an open draft", () => expect(s({})).toBe("join"));
  it("hides a draft with registration off", () => expect(s({ openRegistration: false })).toBe("hidden"));
  it("shows registered players as registered, even when full or past the deadline", () => {
    expect(s({ registered: true })).toBe("registered");
    expect(s({ registered: true, entries: 4 })).toBe("registered");
    expect(s({ registered: true, today: "2026-12-01" })).toBe("registered");
  });
  it("closes once the competition has started or finished", () => {
    expect(s({ status: "active" })).toBe("closed");
    expect(s({ status: "completed" })).toBe("closed");
  });
  it("closes the day after the closing date, not on it", () => {
    expect(s({ today: "2026-11-10" })).toBe("join");
    expect(s({ today: "2026-11-11" })).toBe("closed");
  });
  it("has no deadline when none is set", () => expect(s({ closesOn: null, today: "2030-01-01" })).toBe("join"));
  it("is full at capacity and open with no limit", () => {
    expect(s({ entries: 4 })).toBe("full");
    expect(s({ entries: 3 })).toBe("join");
    expect(s({ maxPlayers: null, entries: 500 })).toBe("join");
  });
  it("only admits the matching level, and everyone when the level is open", () => {
    expect(s({ level: "senior", myLevel: "junior" })).toBe("wrong_level");
    expect(s({ level: "junior", myLevel: "junior" })).toBe("join");
    expect(s({ level: "senior", myLevel: null })).toBe("wrong_level");
  });
  it("reports closed before wrong level when registration is over", () => expect(s({ level: "senior", today: "2026-12-01" })).toBe("closed"));
});

describe("spots helpers", () => {
  it("labels and measures spots", () => {
    expect(spotsLabel(24, 32)).toBe("24 of 32 spots");
    expect(spotsLabel(5, null)).toBe("5 registered");
    expect(spotsPercent(24, 32)).toBe(75);
    expect(spotsPercent(40, 32)).toBe(100);
    expect(spotsPercent(3, null)).toBeNull();
  });
});

describe("visibleToPlayers", () => {
  it("shows running, finished and open drafts only", () => {
    expect(visibleToPlayers("active", false)).toBe(true);
    expect(visibleToPlayers("completed", false)).toBe(true);
    expect(visibleToPlayers("draft", true)).toBe(true);
    expect(visibleToPlayers("draft", false)).toBe(false);
    expect(visibleToPlayers("cancelled", true)).toBe(false);
  });
});
