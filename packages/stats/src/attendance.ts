/** Pure attendance rules. Dates are "YYYY-MM-DD" in the club's own timezone; the caller converts timestamps. */
import { addDays } from "./schedule";

export interface Visit { memberId: string; date: string }
export interface DayCount { date: string; visits: number; people: number }
export interface MemberVisits { memberId: string; days: number; last: string }

/** One entry per day for the last `days` days ending today (oldest first), counting visits and distinct people. */
export function visitsByDay(visits: Visit[], today: string, days = 14): DayCount[] {
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const v = visits.filter((x) => x.date === date);
    out.push({ date, visits: v.length, people: new Set(v.map((x) => x.memberId)).size });
  }
  return out;
}

/** Days each member came (two visits in a day count once), most regular first, ties by most recent. */
export function visitsByMember(visits: Visit[]): MemberVisits[] {
  const by = new Map<string, { days: Set<string>; last: string }>();
  for (const v of visits) {
    const m = by.get(v.memberId) ?? { days: new Set<string>(), last: v.date };
    m.days.add(v.date);
    if (v.date > m.last) m.last = v.date;
    by.set(v.memberId, m);
  }
  return [...by.entries()].map(([memberId, m]) => ({ memberId, days: m.days.size, last: m.last }))
    .sort((a, b) => b.days - a.days || b.last.localeCompare(a.last) || a.memberId.localeCompare(b.memberId));
}

export type Standing = "good" | "due" | "overdue";

/** Whether a member is paid up. Only unpaid dues count; a due that is not yet past its date is "due", past it "overdue". */
export function standing(dues: Array<{ status: string; dueDate: string }>, today: string): Standing {
  const unpaid = dues.filter((d) => d.status === "due" || d.status === "overdue");
  if (unpaid.length === 0) return "good";
  return unpaid.some((d) => d.status === "overdue" || d.dueDate < today) ? "overdue" : "due";
}

export const STANDING_LABEL: Record<Standing, string> = { good: "Paid up", due: "Fee due soon", overdue: "Fee overdue" };

export interface RsvpRow { eventId: string; memberId: string }
export interface ExpectedRow { eventId: string; coming: number; arrived: number; notYet: string[] }

/** For today's sessions: how many said they are coming, how many of those are here, and who has not arrived yet. */
export function expectedToday(rsvps: RsvpRow[], here: string[]): ExpectedRow[] {
  const hereSet = new Set(here);
  const by = new Map<string, Set<string>>();
  for (const r of rsvps) { const s = by.get(r.eventId) ?? new Set<string>(); s.add(r.memberId); by.set(r.eventId, s); }
  return [...by.entries()].map(([eventId, members]) => ({ eventId, coming: members.size, arrived: [...members].filter((m) => hereSet.has(m)).length, notYet: [...members].filter((m) => !hereSet.has(m)).sort() }))
    .sort((a, b) => b.coming - a.coming || a.eventId.localeCompare(b.eventId));
}

/** People who are here but never said they were coming. */
export const walkIns = (rsvps: RsvpRow[], here: string[]): number => { const said = new Set(rsvps.map((r) => r.memberId)); return here.filter((h) => !said.has(h)).length; };
