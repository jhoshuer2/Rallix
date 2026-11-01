/**
 * Birthdays and club anniversaries to spotlight, like the strip at the top of a LinkedIn network page.
 * Pure: pass "today" as a plain date (YYYY-MM-DD in the club's timezone). Only month and day of a birthday are used; age is never exposed.
 */
export type CelebrationMember = { id: string; name: string; photo?: string | null; dob?: string | null; joinedAt: Date | string };
export type Celebration = { id: string; memberId: string; name: string; photo: string | null; kind: "birthday" | "anniversary" | "new"; label: string; offsetDays: number };

const DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return { y: y!, m: m!, d: d! }; };
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The month/day occurrence nearest to `today` (this year, last year or next year). A 29 Feb date falls on 28 Feb in non-leap years. */
function nearestOccurrence(month: number, day: number, today: { y: number; m: number; d: number }) {
  const t = utc(today.y, today.m, today.d);
  let best = Infinity;
  for (const y of [today.y - 1, today.y, today.y + 1]) {
    const d = month === 2 && day === 29 && !isLeap(y) ? 28 : day;
    const off = Math.round((utc(y, month, d) - t) / DAY);
    if (Math.abs(off) < Math.abs(best)) best = off;
  }
  return best;
}

function when(offset: number) {
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";
  if (offset === -1) return "yesterday";
  return offset > 0 ? `in ${offset} days` : `${-offset} days ago`;
}

export function celebrations(members: CelebrationMember[], today: string, windowDays = 7): Celebration[] {
  const t = parse(today);
  const out: Celebration[] = [];
  for (const m of members) {
    if (m.dob && /^\d{4}-\d{2}-\d{2}/.test(m.dob)) {
      const b = parse(m.dob);
      const off = nearestOccurrence(b.m, b.d, t);
      if (Math.abs(off) <= windowDays) out.push({ id: `b-${m.id}`, memberId: m.id, name: m.name, photo: m.photo ?? null, kind: "birthday", label: `Birthday ${when(off)}`, offsetDays: off });
    }
    const j = typeof m.joinedAt === "string" ? parse(m.joinedAt) : parse(m.joinedAt.toISOString());
    const joinedUtc = utc(j.y, j.m, j.d), todayUtc = utc(t.y, t.m, t.d);
    const sinceDays = Math.round((todayUtc - joinedUtc) / DAY);
    if (sinceDays >= 0 && sinceDays <= windowDays) {
      out.push({ id: `n-${m.id}`, memberId: m.id, name: m.name, photo: m.photo ?? null, kind: "new", label: sinceDays === 0 ? "Joined today" : "New in the club", offsetDays: -sinceDays });
    } else {
      const off = nearestOccurrence(j.m, j.d, t);
      // The anniversary falls in a neighbouring year when the window crosses New Year.
      const anniversaryYear = t.y + (off > 0 && j.m < t.m ? 1 : off < 0 && j.m > t.m ? -1 : 0);
      const yrs = anniversaryYear - j.y;
      if (yrs >= 1 && Math.abs(off) <= windowDays) out.push({ id: `a-${m.id}`, memberId: m.id, name: m.name, photo: m.photo ?? null, kind: "anniversary", label: `${yrs}-year anniversary ${when(off)}`, offsetDays: off });
    }
  }
  // Today first, then upcoming (soonest first), then recent (most recent first). On the same day: birthdays, then anniversaries, then new members.
  const soon = (c: Celebration) => (c.offsetDays === 0 ? 0 : c.offsetDays > 0 ? c.offsetDays : 100 - c.offsetDays);
  const kind = { birthday: 0, anniversary: 1, new: 2 } as const;
  return out.sort((a, b) => soon(a) - soon(b) || kind[a.kind] - kind[b.kind] || a.name.localeCompare(b.name));
}
