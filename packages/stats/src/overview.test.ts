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
