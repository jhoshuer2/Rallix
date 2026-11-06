/**
 * Birthdays and club anniversaries to spotlight, like the strip at the top of a LinkedIn network page.
 * Pure: pass "today" as a plain date (YYYY-MM-DD in the club's timezone). Only month and day of a birthday are used; age is never exposed.
 */
export type CelebrationMember = { id: string; name: string; photo?: string | null; dob?: string | null; joinedAt: Date | string; /** Admins who are not players: only their birthday is celebrated, not joining or anniversaries. */ birthdayOnly?: boolean };
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

/** The club itself, for its own anniversary (from the day it was created). */
export type CelebrationClub = { name: string; logo?: string | null; createdAt: Date | string };

export function celebrations(members: CelebrationMember[], today: string, windowDays = 7, club?: CelebrationClub): Celebration[] {
  const t = parse(today);
  const out: Celebration[] = [];
  if (club) {
    const c = typeof club.createdAt === "string" ? parse(club.createdAt) : parse(club.createdAt.toISOString());
    const off = nearestOccurrence(c.m, c.d, t);
    const year = t.y + (off > 0 && c.m < t.m ? 1 : off < 0 && c.m > t.m ? -1 : 0);
    const yrs = year - c.y;
    if (yrs >= 1 && Math.abs(off) <= windowDays) out.push({ id: "club-anniversary", memberId: "club", name: club.name, photo: club.logo ?? null, kind: "anniversary", label: `${yrs}-year anniversary ${when(off)}`, offsetDays: off });
  }
  for (const m of members) {
    if (m.dob && /^\d{4}-\d{2}-\d{2}/.test(m.dob)) {
      const b = parse(m.dob);
      const off = nearestOccurrence(b.m, b.d, t);
      if (Math.abs(off) <= windowDays) out.push({ id: `b-${m.id}`, memberId: m.id, name: m.name, photo: m.photo ?? null, kind: "birthday", label: `Birthday ${when(off)}`, offsetDays: off });
    }
    if (m.birthdayOnly) continue;
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
  // The club's own anniversary leads the others on its day.
  const club1 = (c: Celebration) => (c.memberId === "club" ? 0 : 1);
  return out.sort((a, b) => soon(a) - soon(b) || club1(a) - club1(b) || kind[a.kind] - kind[b.kind] || a.name.localeCompare(b.name));
}


export type CelebrationTile =
  | ({ type: "person" } & Celebration)
  | { type: "group"; id: string; label: string; count: number; faces: Array<{ name: string; photo: string | null }> }
  | { type: "more"; id: string; label: string; count: number };

/**
 * What the Club updates strip actually shows, so a big club never gets a wall of tiles.
 * - Birthdays and anniversaries are shown one by one (the list is already ordered soonest first).
 * - New members are shown one by one only while there are `collapseNewAfter` or fewer; more than that become ONE tile ("12 new players").
 * - At most `max` tiles; whatever does not fit becomes a final "+N more" tile counting people.
 */
export function celebrationTiles(items: Celebration[], opts: { max?: number; collapseNewAfter?: number } = {}): CelebrationTile[] {
  const max = Math.max(2, opts.max ?? 8), collapseAfter = opts.collapseNewAfter ?? 3;
  const fresh = items.filter((c) => c.kind === "new");
  const collapse = fresh.length > collapseAfter;
  const tiles: CelebrationTile[] = [];
  let groupPlaced = false;
  for (const c of items) {
    if (c.kind === "new" && collapse) {
      if (groupPlaced) continue;
      groupPlaced = true;
      tiles.push({ type: "group", id: "new-members", label: `${fresh.length} new players`, count: fresh.length, faces: fresh.slice(0, 3).map((f) => ({ name: f.name, photo: f.photo })) });
    } else tiles.push({ type: "person", ...c });
  }
  if (tiles.length <= max) return tiles;
  // The group tile is news for the whole club, so it keeps a slot even when many birthdays compete for room.
  const group = tiles.find((t) => t.type === "group");
  if (group) {
    const persons = tiles.filter((t) => t.type === "person");
    const keptPersons = persons.slice(0, max - 2);
    const left = persons.length - keptPersons.length;
    return left > 0 ? [...keptPersons, group, { type: "more", id: "more", label: `+${left} more`, count: left }] : [...keptPersons, group];
  }
  const kept = tiles.slice(0, max - 1);
  const hidden = tiles.slice(max - 1).reduce((n, t) => n + (t.type === "group" ? t.count : 1), 0);
  return [...kept, { type: "more", id: "more", label: `+${hidden} more`, count: hidden }];
}

/** A birthday is stored as a date. When the person gives no year we keep 1904 (a leap year, so 29 Feb works) and never show an age. */
export const UNKNOWN_BIRTH_YEAR = 1904;
export const hasBirthYear = (dob: string | null | undefined): boolean => !!dob && /^\d{4}-/.test(dob) && Number(dob.slice(0, 4)) > UNKNOWN_BIRTH_YEAR;

/** Month (1-12) and day (1-31) to a storable date, or a plain-words problem. `keepYear` is a real birth year already on file, kept as is. */
export function birthdayToDate(month: unknown, day: unknown, keepYear?: number | null): { ok: true; date: string } | { ok: false; error: string } {
  const m = Number(month), d = Number(day);
  if (!Number.isInteger(m) || m < 1 || m > 12) return { ok: false, error: "Choose a month." };
  if (!Number.isInteger(d) || d < 1 || d > 31) return { ok: false, error: "Choose a day." };
  const y = keepYear && keepYear > UNKNOWN_BIRTH_YEAR ? keepYear : UNKNOWN_BIRTH_YEAR;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return { ok: false, error: "That date doesn’t exist. Check the day." };
  return { ok: true, date: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}
