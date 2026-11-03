import { describe, expect, it } from "vitest";
import { mergeActivity, membershipOverview } from "./overview";

const t = "2026-11-02";
describe("membershipOverview", () => {
  it("uses each member's latest due only", () => {
    const o = membershipOverview([
      { membershipId: "a", status: "overdue", dueDate: "2026-09-01" },
      { membershipId: "a", status: "paid", dueDate: "2026-12-15" },
    ], t);
    expect(o).toEqual({ paid: 1, unpaid: 0, expiring: 0, active: 1, total: 1 });
  });
  it("classifies unpaid, expiring and paid", () => {
    const o = membershipOverview([
      { membershipId: "a", status: "due", dueDate: "2026-11-01" },
      { membershipId: "b", status: "paid", dueDate: "2026-11-10" },
      { membershipId: "c", status: "due", dueDate: "2026-11-09" },
      { membershipId: "d", status: "paid", dueDate: "2027-01-01" },
      { membershipId: "e", status: "overdue", dueDate: "2026-12-30" },
    ], t);
    expect(o).toEqual({ paid: 1, unpaid: 2, expiring: 2, active: 3, total: 5 });
  });
  it("is empty without dues", () => expect(membershipOverview([], t).total).toBe(0));
});

describe("mergeActivity", () => {
  const at = (n: number) => new Date(2026, 10, n);
  it("sorts newest first, dedupes and caps", () => {
    const m = mergeActivity([[{ id: "1", kind: "member", at: at(1), title: "a" }, { id: "2", kind: "payment", at: at(3), title: "b" }], [{ id: "2", kind: "payment", at: at(3), title: "b" }, { id: "3", kind: "result", at: at(2), title: "c" }]], 2);
    expect(m.map((x) => x.id)).toEqual(["2", "3"]);
  });
});

import { groupRegistrations } from "./overview";
describe("groupRegistrations", () => {
  const at = (day: number, hour = 10) => new Date(Date.UTC(2026, 10, day, hour));
  const reg = (id: string, d: Date) => ({ id, name: `P${id}`, at: d });
  it("lists a quiet day person by person", () => {
    const out = groupRegistrations([reg("1", at(2)), reg("2", at(2, 12))]);
    expect(out.map((a) => a.title)).toEqual(["P2 joined", "P1 joined"]);
  });
  it("turns a busy day into one row, and 100 sign-ups do not crowd out other days", () => {
    const rush = Array.from({ length: 100 }, (_, i) => reg(String(i), at(2, 8 + (i % 10))));
    const out = groupRegistrations([...rush, reg("x", at(1))]);
    expect(out).toHaveLength(2);
    expect(out[0]!.title).toBe("100 players joined");
    expect(out[1]!.title).toBe("Px joined");
  });
  it("groups by the club's local day, not UTC", () => {
    const lateNight = [reg("a", new Date("2026-11-02T23:30:00Z")), reg("b", new Date("2026-11-02T23:45:00Z")), reg("c", new Date("2026-11-03T00:10:00Z"))];
    const out = groupRegistrations(lateNight); // all three are 3 Nov in Lagos (UTC+1)
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("3 players joined");
  });
  it("applies the links", () => {
    const out = groupRegistrations([reg("1", at(2))], { hrefOne: (id) => `/members/${id}` });
    expect(out[0]!.href).toBe("/members/1");
  });
});
