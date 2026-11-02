import { describe, expect, it } from "vitest";
import { clampOffset, countdown, cropRect, fitWithin, initials, placeholderColors, scoreLine } from "./premium-utils";

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

describe("picture cropping", () => {
  const base = { imgW: 4000, imgH: 3000, boxW: 280, boxH: 280, zoom: 1, offsetX: 0, offsetY: 0 };
  it("centres the biggest square by default, whatever the picture shape", () => {
    expect(cropRect(base)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 }); // landscape: trims the sides
    const tall = cropRect({ ...base, imgW: 3000, imgH: 4000 });
    expect(tall).toEqual({ sx: 0, sy: 500, sw: 3000, sh: 3000 }); // portrait: trims top and bottom
  });
  it("zooming in shows a smaller part of the picture", () => {
    const r = cropRect({ ...base, zoom: 2 });
    expect(r.sw).toBe(1500); expect(r.sh).toBe(1500);
    expect(r.sx).toBe(1250); expect(r.sy).toBe(750);
  });
  it("dragging moves the crop, but never past the edge of the picture", () => {
    const left = cropRect({ ...base, offsetX: 99999 });
    expect(left.sx).toBe(0); // dragged as far right as possible reveals the left edge, not empty space
    const right = cropRect({ ...base, offsetX: -99999 });
    expect(right.sx).toBe(1000);
    expect(clampOffset({ ...base, offsetY: 500 })).toEqual({ x: 0, y: 0 }); // square-fit image has no vertical slack at zoom 1
  });
  it("never produces a rectangle outside the picture, for any zoom and offset", () => {
    for (const zoom of [1, 1.3, 2, 3]) for (const ox of [-5000, -10, 0, 40, 5000]) for (const oy of [-5000, 0, 5000]) {
      const r = cropRect({ ...base, zoom, offsetX: ox, offsetY: oy });
      expect(r.sx).toBeGreaterThanOrEqual(0); expect(r.sy).toBeGreaterThanOrEqual(0);
      expect(r.sx + r.sw).toBeLessThanOrEqual(4000 + 1e-6); expect(r.sy + r.sh).toBeLessThanOrEqual(3000 + 1e-6);
    }
  });
  it("keeps the 16:10 shape for a cover and treats zoom below 1 as 1", () => {
    const r = cropRect({ imgW: 2000, imgH: 2000, boxW: 320, boxH: 200, zoom: 0.2, offsetX: 0, offsetY: 0 });
    expect(r.sw / r.sh).toBeCloseTo(1.6, 5);
  });
  it("fitWithin shrinks to the limit and never upscales", () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ w: 1280, h: 960 });
    expect(fitWithin(800, 600, 1280)).toEqual({ w: 800, h: 600 });
  });
});
