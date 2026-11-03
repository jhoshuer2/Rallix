/** Pure schedule rules: expand weekly sessions, hide them on closed days, group by day. Dates are "YYYY-MM-DD" in the club's own timezone. */

export type EventKind = "play" | "event" | "closed";
export interface ScheduleEvent {
  id: string; kind: EventKind; title: string; note?: string | null;
  startsOn: string; endsOn?: string | null; startTime?: string | null; endTime?: string | null; repeatsWeekly?: boolean; until?: string | null;
}
export interface Occurrence { eventId: string; kind: EventKind; title: string; note: string | null; date: string; endDate: string | null; startTime: string | null; endTime: string | null }

const MS = 86400000;
const ts = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const addDays = (d: string, n: number) => new Date(ts(d) + n * MS).toISOString().slice(0, 10);
const diff = (a: string, b: string) => Math.round((ts(b) - ts(a)) / MS);

/** True when a closure covers this day. */
export function closedOn(events: ScheduleEvent[], day: string): ScheduleEvent | null {
  return events.find((e) => e.kind === "closed" && e.startsOn <= day && day <= (e.endsOn ?? e.startsOn)) ?? null;
}

/** Everything that happens between `from` and `to` (inclusive), soonest first. Weekly sessions repeat on the weekday of their first date and are dropped on closed days. */
export function occurrences(events: ScheduleEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  const mk = (e: ScheduleEvent, date: string): Occurrence => ({ eventId: e.id, kind: e.kind, title: e.title, note: e.note ?? null, date, endDate: e.endsOn && e.endsOn !== date ? e.endsOn : null, startTime: e.startTime ?? null, endTime: e.endTime ?? null });
  for (const e of events) {
    if (e.repeatsWeekly && e.kind === "play") {
      const last = e.until && e.until < to ? e.until : to;
      let d = e.startsOn;
      if (d < from) d = addDays(d, Math.ceil(diff(d, from) / 7) * 7);
      for (; d <= last; d = addDays(d, 7)) if (!closedOn(events, d)) out.push(mk(e, d));
    } else if (e.kind === "closed") {
      const end = e.endsOn ?? e.startsOn;
      if (end >= from && e.startsOn <= to) out.push(mk(e, e.startsOn < from ? from : e.startsOn));
    } else {
      if (e.startsOn >= from && e.startsOn <= to && !(e.kind === "play" && closedOn(events, e.startsOn))) out.push(mk(e, e.startsOn));
    }
  }
  const order = { closed: 0, event: 1, play: 2 } as const;
  return out.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title));
}

export function groupByDay<T extends { date: string }>(items: T[]): Array<{ date: string; items: T[] }> {
  const out: Array<{ date: string; items: T[] }> = [];
  for (const it of items) { const g = out[out.length - 1]; if (g && g.date === it.date) g.items.push(it); else out.push({ date: it.date, items: [it] }); }
  return out;
}

/** "18:00–20:00", "from 18:00" or "All day". */
export const timeLabel = (o: { startTime: string | null; endTime: string | null }) => (o.startTime ? (o.endTime ? `${o.startTime}–${o.endTime}` : `from ${o.startTime}`) : "All day");

export function dayLabel(date: string, today: string): string {
  const n = diff(today, date);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return new Date(ts(date)).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
}

/** A short notice when the club is closed today or tomorrow, otherwise null. */
export function closureNotice(events: ScheduleEvent[], today: string): string | null {
  const t = closedOn(events, today); if (t) return `Closed today: ${t.title}`;
  const m = closedOn(events, addDays(today, 1)); if (m) return `Closed tomorrow: ${m.title}`;
  return null;
}
