import { describe, expect, it } from "vitest";
import { countdown, initials, placeholderColors, scoreLine } from "./premium-utils";

describe("placeholder colours", () => {
  it("are stable for a name and ignore case and spaces at the ends", () => {
    expect(placeholderColors("Ada Obi")).toEqual(placeholderColors("  ada obi "));
  });
  it("differ across many names (not one colour for everyone)", () => {
    const set = new Set(["Ada", "Bola", "Chidi", "Dayo", "Efe", "Femi", "Gozie", "Hauwa"].map((n) => placeholderColors(n).from));
    expect(set.size).toBeGreaterThan(2);
  });
  it("never throws on an empty name", () => { expect(placeholderColors("").from).toMatch(/^#/); });
});

describe("initials", () => {
  it("uses first and last word", () => { expect(initials("Joshua Michael Jumbo")).toBe("JJ"); });
  it("handles one word, blanks and extra spaces", () => {
    expect(initials("Madonna")).toBe("MA"); expect(initials("")).toBe("?"); expect(initials("   ")).toBe("?"); expect(initials("  Ada   Obi ")).toBe("AO");
  });
});

describe("countdown", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  it("shows days and hours, then hours and minutes, then minutes", () => {
    expect(countdown(new Date("2026-11-03T14:30:00Z"), now)).toBe("2d 4h");
    expect(countdown(new Date("2026-11-01T13:20:00Z"), now)).toBe("3h 20m");
    expect(countdown(new Date("2026-11-01T10:45:00Z"), now)).toBe("45m");
  });
  it("rounds a few seconds up to 1m and says Now once started", () => {
    expect(countdown(new Date("2026-11-01T10:00:20Z"), now)).toBe("1m");
    expect(countdown(new Date("2026-11-01T09:59:00Z"), now)).toBe("Now");
    expect(countdown(new Date("nope"), now)).toBe("Now");
  });
});

describe("scoreLine", () => {
  it("formats games won and a dash when unknown", () => { expect(scoreLine(3, 1)).toBe("3–1"); expect(scoreLine(null, 2)).toBe("–"); expect(scoreLine(0, 0)).toBe("0–0"); });
});
