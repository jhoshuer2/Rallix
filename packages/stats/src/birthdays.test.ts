import { describe, expect, it } from "vitest";
import { birthdayToDate, celebrations, hasBirthYear } from "./celebrations";

const none = (id: string, joined = "2026-01-01") => ({ id, name: id, joinedAt: joined });

describe("club anniversary (from the day the club was created)", () => {
  const club = (createdAt: string) => ({ name: "Paris Arena", logo: "/l.webp", createdAt });
  it("shows on the day and within the window, with the years", () => {
    const today = celebrations([], "2026-11-05", 7, club("2023-11-05T10:00:00Z"));
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ kind: "anniversary", name: "Paris Arena", photo: "/l.webp", label: "3-year anniversary today", memberId: "club" });
    expect(celebrations([], "2026-11-02", 7, club("2023-11-05"))[0]!.label).toBe("3-year anniversary in 3 days");
    expect(celebrations([], "2026-11-09", 7, club("2023-11-05"))[0]!.label).toBe("3-year anniversary 4 days ago");
  });
  it("does not show before the first year, or far from the day", () => {
    expect(celebrations([], "2026-11-05", 7, club("2026-11-05"))).toHaveLength(0);
    expect(celebrations([], "2026-11-05", 7, club("2025-11-20"))).toHaveLength(0);
    expect(celebrations([], "2026-06-01", 7, club("2023-11-05"))).toHaveLength(0);
  });
  it("works across New Year", () => {
    expect(celebrations([], "2026-12-30", 7, club("2024-01-02"))[0]!.label).toBe("3-year anniversary in 3 days");
    expect(celebrations([], "2027-01-01", 7, club("2024-12-30"))[0]!.label).toBe("2-year anniversary 2 days ago");
  });
  it("leads the other celebrations on its day", () => {
    const out = celebrations([{ id: "b", name: "Aaa", dob: "1990-11-05", joinedAt: "2026-01-01" }], "2026-11-05", 7, club("2023-11-05"));
    expect(out.map((c) => c.name)).toEqual(["Paris Arena", "Aaa"]);
  });
  it("is absent when no club is given", () => {
    expect(celebrations([none("x")], "2026-11-05")).toHaveLength(0);
  });
});

describe("birthdayToDate", () => {
  it("stores month and day with the unknown-year marker", () => {
    expect(birthdayToDate(11, 5)).toEqual({ ok: true, date: "1904-11-05" });
    expect(birthdayToDate("2", "29")).toEqual({ ok: true, date: "1904-02-29" });
  });
  it("keeps a real birth year already on file", () => {
    expect(birthdayToDate(3, 9, 1990)).toEqual({ ok: true, date: "1990-03-09" });
    expect(birthdayToDate(2, 29, 1990)).toMatchObject({ ok: false }); // 1990 is not a leap year
    expect(birthdayToDate(3, 9, 1904)).toEqual({ ok: true, date: "1904-03-09" });
  });
  it("refuses impossible dates and junk", () => {
    for (const [m, d] of [[2, 30], [4, 31], [13, 1], [0, 5], [5, 0], [5, 32], ["x", 3], [3, 1.5], [null, null]] as const) expect(birthdayToDate(m, d)).toMatchObject({ ok: false });
  });
});

describe("hasBirthYear", () => {
  it("tells a real year from the unknown marker", () => {
    expect(hasBirthYear("1990-03-09")).toBe(true);
    expect(hasBirthYear("1904-03-09")).toBe(false);
    expect(hasBirthYear(null)).toBe(false);
  });
});

describe("birthday only members (admins who do not play)", () => {
  it("get a birthday but never a new-member or anniversary tile", () => {
    const out = celebrations([{ id: "a", name: "Admin", dob: "1980-11-05", joinedAt: "2026-11-05", birthdayOnly: true }, { id: "b", name: "Admin2", joinedAt: "2024-11-05", birthdayOnly: true }], "2026-11-05");
    expect(out.map((c) => [c.name, c.kind])).toEqual([["Admin", "birthday"]]);
  });
});
