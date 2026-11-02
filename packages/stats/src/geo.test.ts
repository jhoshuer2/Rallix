import { describe, expect, it } from "vitest";
import { distanceM, isHereNow, shouldAlert, withinVenue } from "./geo";

const court = { lat: 9.0765, lng: 7.3986 }; // Abuja
const metresNorth = (m: number) => ({ lat: court.lat + m / 111_195, lng: court.lng });

describe("distanceM", () => {
  it("is zero for the same point and symmetric", () => {
    expect(distanceM(court, court)).toBe(0);
    expect(distanceM(court, metresNorth(500))).toBeCloseTo(distanceM(metresNorth(500), court), 6);
  });
  it("measures about 100 m for a 100 m step", () => expect(distanceM(court, metresNorth(100))).toBeGreaterThan(99));
  it("handles the antimeridian", () => expect(distanceM({ lat: 0, lng: 179.9995 }, { lat: 0, lng: -179.9995 })).toBeLessThan(120));
});

describe("withinVenue", () => {
  it("accepts a point inside the radius", () => expect(withinVenue(metresNorth(60), 15, court, 100).ok).toBe(true));
  it("refuses a point well outside", () => expect(withinVenue(metresNorth(400), 15, court, 100)).toMatchObject({ ok: false, reason: "far" }));
  it("allows the reported accuracy as slack at the edge", () => {
    expect(withinVenue(metresNorth(110), 20, court, 100).ok).toBe(true);
    expect(withinVenue(metresNorth(130), 20, court, 100).ok).toBe(false);
  });
  it("refuses a vague fix however close it looks", () => expect(withinVenue(court, 400, court, 100)).toMatchObject({ ok: false, reason: "inaccurate" }));
  it("refuses bad input", () => {
    expect(withinVenue({ lat: NaN, lng: 0 }, 10, court, 100)).toMatchObject({ reason: "invalid" });
    expect(withinVenue({ lat: 95, lng: 0 }, 10, court, 100)).toMatchObject({ reason: "invalid" });
    expect(withinVenue(court, -1, court, 100)).toMatchObject({ reason: "invalid" });
    expect(withinVenue(court, 10, court, 0)).toMatchObject({ reason: "invalid" });
  });
});

describe("alert throttle and presence", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  it("alerts when never alerted or after two hours", () => {
    expect(shouldAlert(null, now)).toBe(true);
    expect(shouldAlert(new Date("2026-11-02T09:59:00Z"), now)).toBe(true);
  });
  it("does not alert twice within two hours", () => expect(shouldAlert(new Date("2026-11-02T10:30:00Z"), now)).toBe(false));
  it("counts someone as here until they leave or six hours pass", () => {
    expect(isHereNow(new Date("2026-11-02T10:00:00Z"), null, now)).toBe(true);
    expect(isHereNow(new Date("2026-11-02T10:00:00Z"), new Date("2026-11-02T11:00:00Z"), now)).toBe(false);
    expect(isHereNow(new Date("2026-11-02T05:00:00Z"), null, now)).toBe(false);
  });
});

import { arrivalMessage } from "./geo";
describe("arrivalMessage", () => {
  it("uses the first name and a player count", () => {
    expect(arrivalMessage("Ade Obi", "Paris Arena", 3)).toEqual({ title: "Ade just arrived", body: "Paris Arena · 3 players here" });
    expect(arrivalMessage("  ", "Paris Arena", 1)).toEqual({ title: "A player just arrived", body: "Paris Arena · 1 player here" });
  });
});
