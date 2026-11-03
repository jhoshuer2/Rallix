import { describe, expect, it } from "vitest";
import { closedOn, closureNotice, doorsLabel, groupByDay, occurrences, rangeEnd, timeLabel, dayLabel, type ScheduleEvent } from "./index";

const tue: ScheduleEvent = { id: "p", kind: "play", title: "Tuesday night", startsOn: "2030-01-01", repeatsWeekly: true, startTime: "18:00", endTime: "20:00" };
const closed: ScheduleEvent = { id: "c", kind: "closed", title: "New Year break", startsOn: "2030-01-08", endsOn: "2030-01-10" };
const ev: ScheduleEvent = { id: "e", kind: "event", title: "Club social", startsOn: "2030-01-12" };

describe("occurrences", () => {
  it("repeats a weekly session on its weekday inside the window", () => {
    const o = occurrences([tue], "2030-01-01", "2030-01-31");
    expect(o.map((x) => x.date)).toEqual(["2030-01-01", "2030-01-08", "2030-01-15", "2030-01-22", "2030-01-29"]);
  });
  it("starts the repeat on the right weekday when the window starts later", () => {
    expect(occurrences([tue], "2030-01-10", "2030-01-20").map((x) => x.date)).toEqual(["2030-01-15"]);
    expect(occurrences([tue], "2029-12-01", "2029-12-31")).toEqual([]);
  });
  it("stops at `until`", () => {
    expect(occurrences([{ ...tue, until: "2030-01-15" }], "2030-01-01", "2030-02-28").map((x) => x.date)).toEqual(["2030-01-01", "2030-01-08", "2030-01-15"]);
  });
  it("drops sessions on closed days and shows the closure once", () => {
    const o = occurrences([tue, closed], "2030-01-01", "2030-01-20");
    expect(o.filter((x) => x.kind === "play").map((x) => x.date)).toEqual(["2030-01-01", "2030-01-15"]);
    expect(o.filter((x) => x.kind === "closed")).toHaveLength(1);
    expect(o.find((x) => x.kind === "closed")).toMatchObject({ date: "2030-01-08", endDate: "2030-01-10" });
  });
  it("shows a closure already under way from the first day of the window", () => {
    expect(occurrences([closed], "2030-01-09", "2030-01-20")[0]).toMatchObject({ date: "2030-01-09", endDate: "2030-01-10" });
    expect(occurrences([closed], "2030-01-11", "2030-01-20")).toEqual([]);
  });
  it("keeps one-off events, sorted with closures first, then events, then sessions", () => {
    const same: ScheduleEvent = { id: "x", kind: "play", title: "Extra", startsOn: "2030-01-12", startTime: "09:00" };
    const o = occurrences([same, ev, { id: "k", kind: "closed", title: "Floor", startsOn: "2030-01-13" }], "2030-01-01", "2030-01-31");
    expect(o.map((x) => x.title)).toEqual(["Club social", "Extra", "Floor"]);
    expect(occurrences([ev], "2030-02-01", "2030-02-28")).toEqual([]);
  });
});

describe("helpers", () => {
  it("closedOn and the closure notice", () => {
    expect(closedOn([closed], "2030-01-09")?.id).toBe("c");
    expect(closedOn([closed], "2030-01-11")).toBeNull();
    expect(closureNotice([closed], "2030-01-08")).toBe("Closed today: New Year break");
    expect(closureNotice([closed], "2030-01-07")).toBe("Closed tomorrow: New Year break");
    expect(closureNotice([closed], "2030-01-05")).toBeNull();
  });
  it("groups by day and labels times and days", () => {
    const g = groupByDay(occurrences([tue, ev], "2030-01-01", "2030-01-15"));
    expect(g.map((x) => x.date)).toEqual(["2030-01-01", "2030-01-08", "2030-01-12", "2030-01-15"]);
    expect(timeLabel({ startTime: "18:00", endTime: "20:00" })).toBe("18:00–20:00");
    expect(timeLabel({ startTime: "18:00", endTime: null })).toBe("from 18:00");
    expect(timeLabel({ startTime: null, endTime: null })).toBe("All day");
    expect(dayLabel("2030-01-01", "2030-01-01")).toBe("Today");
    expect(dayLabel("2030-01-02", "2030-01-01")).toBe("Tomorrow");
    expect(dayLabel("2030-01-05", "2030-01-01")).toMatch(/Saturday/);
  });
});

describe("doors open and the calendar range", () => {
  it("carries doors open through to each occurrence and labels it", () => {
    const e: ScheduleEvent = { id: "p", kind: "play", title: "Tuesday night", startsOn: "2030-01-01", repeatsWeekly: true, startTime: "18:00", doorsOpen: "17:45" };
    const o = occurrences([e], "2030-01-01", "2030-01-10");
    expect(o.every((x) => x.doorsOpen === "17:45")).toBe(true);
    expect(doorsLabel(o[0]!)).toBe("Doors open 17:45");
    expect(doorsLabel({ doorsOpen: null })).toBeNull();
    expect(occurrences([{ ...e, doorsOpen: undefined }], "2030-01-01", "2030-01-02")[0]!.doorsOpen).toBeNull();
  });
  it("gives the last day of each calendar range", () => {
    expect(rangeEnd("today", "2030-01-10")).toBe("2030-01-10");
    expect(rangeEnd("week", "2030-01-10")).toBe("2030-01-16");
    expect(rangeEnd("month", "2030-01-10")).toBe("2030-02-08");
    expect(rangeEnd("week", "2030-02-27")).toBe("2030-03-05");
  });
});
