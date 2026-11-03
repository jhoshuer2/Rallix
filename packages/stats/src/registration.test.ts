import { describe, expect, it } from "vitest";
import { ordinal, registrationState, spotsLabel, spotsLeftLabel, spotsPercent, visibleToPlayers, waitlistPosition, type RegistrationInput } from "./registration";

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
  it("offers the waitlist at capacity, and shows who is already in line", () => {
    expect(s({ entries: 4 })).toBe("waitlist");
    expect(s({ entries: 4, waiting: true })).toBe("waiting");
    expect(s({ entries: 4, waiting: true, today: "2030-12-01", closesOn: "2030-01-01" })).toBe("closed"); // the deadline ends the queue too
    expect(s({ entries: 4, registered: true, waiting: true })).toBe("registered");
    expect(s({ entries: 4, level: "senior", myLevel: "junior" })).toBe("wrong_level");
  });
  it("is open with room and with no limit", () => {
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

describe("waitlist helpers", () => {
  it("orders the queue by who joined first", () => {
    const w = [{ id: "b", at: "2030-01-02T10:00:00Z" }, { id: "a", at: "2030-01-01T10:00:00Z" }, { id: "c", at: new Date("2030-01-03T10:00:00Z") }];
    expect(waitlistPosition(w, "a")).toBe(1);
    expect(waitlistPosition(w, "b")).toBe(2);
    expect(waitlistPosition(w, "c")).toBe(3);
    expect(waitlistPosition(w, "z")).toBeNull();
    expect(waitlistPosition([], "a")).toBeNull();
    expect(waitlistPosition([{ id: "y", at: "2030-01-01T10:00:00Z" }, { id: "x", at: "2030-01-01T10:00:00Z" }], "y")).toBe(2); // a tie is broken the same way every time
  });
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
  });
  it("says how many spots are left", () => {
    expect(spotsLeftLabel(13, 16)).toBe("3 spots left");
    expect(spotsLeftLabel(15, 16)).toBe("1 spot left");
    expect(spotsLeftLabel(16, 16)).toBe("Full");
    expect(spotsLeftLabel(20, 16)).toBe("Full");
    expect(spotsLeftLabel(5, null)).toBeNull();
  });
});
