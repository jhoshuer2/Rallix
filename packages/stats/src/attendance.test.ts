import { describe, expect, it } from "vitest";
import { expectedToday, standing, visitsByDay, visitsByMember, walkIns } from "./index";

const V = (memberId: string, date: string) => ({ memberId, date });

describe("visitsByDay", () => {
  it("returns every day of the window, oldest first, counting visits and distinct people", () => {
    const r = visitsByDay([V("a", "2030-01-10"), V("a", "2030-01-10"), V("b", "2030-01-10"), V("a", "2030-01-08"), V("a", "2029-12-01")], "2030-01-10", 3);
    expect(r).toEqual([{ date: "2030-01-08", visits: 1, people: 1 }, { date: "2030-01-09", visits: 0, people: 0 }, { date: "2030-01-10", visits: 3, people: 2 }]);
  });
  it("handles no visits and month boundaries", () => {
    expect(visitsByDay([], "2030-03-01", 2).map((d) => d.date)).toEqual(["2030-02-28", "2030-03-01"]);
    expect(visitsByDay([], "2030-03-01", 2).every((d) => d.visits === 0)).toBe(true);
  });
});

describe("visitsByMember", () => {
  it("counts days not visits, orders by regularity then recency", () => {
    const r = visitsByMember([V("a", "2030-01-01"), V("a", "2030-01-01"), V("a", "2030-01-03"), V("b", "2030-01-05"), V("b", "2030-01-06"), V("c", "2030-01-09")]);
    expect(r).toEqual([{ memberId: "b", days: 2, last: "2030-01-06" }, { memberId: "a", days: 2, last: "2030-01-03" }, { memberId: "c", days: 1, last: "2030-01-09" }]);
    expect(visitsByMember([])).toEqual([]);
  });
});

describe("standing", () => {
  const today = "2030-01-10";
  it("is good with nothing unpaid", () => {
    expect(standing([], today)).toBe("good");
    expect(standing([{ status: "paid", dueDate: "2029-01-01" }], today)).toBe("good");
  });
  it("is due before the date and overdue after it or when marked overdue", () => {
    expect(standing([{ status: "due", dueDate: "2030-01-20" }], today)).toBe("due");
    expect(standing([{ status: "due", dueDate: "2030-01-10" }], today)).toBe("due");
    expect(standing([{ status: "due", dueDate: "2030-01-09" }], today)).toBe("overdue");
    expect(standing([{ status: "overdue", dueDate: "2030-02-01" }], today)).toBe("overdue");
    expect(standing([{ status: "due", dueDate: "2030-01-20" }, { status: "overdue", dueDate: "2029-12-01" }], today)).toBe("overdue");
  });
});

describe("expectedToday", () => {
  const r = (eventId: string, memberId: string) => ({ eventId, memberId });
  it("counts who is coming, who has arrived, and who is still to come", () => {
    const out = expectedToday([r("e1", "a"), r("e1", "b"), r("e1", "c"), r("e2", "a")], ["a", "z"]);
    expect(out).toEqual([{ eventId: "e1", coming: 3, arrived: 1, notYet: ["b", "c"] }, { eventId: "e2", coming: 1, arrived: 1, notYet: [] }]);
  });
  it("counts a person once per event and handles nothing", () => {
    expect(expectedToday([r("e1", "a"), r("e1", "a")], [])[0]).toMatchObject({ coming: 1, arrived: 0 });
    expect(expectedToday([], ["a"])).toEqual([]);
  });
  it("counts walk-ins: here but never said they were coming", () => {
    expect(walkIns([r("e1", "a")], ["a", "z", "y"])).toBe(2);
    expect(walkIns([], ["a"])).toBe(1);
    expect(walkIns([r("e1", "a")], [])).toBe(0);
  });
});
