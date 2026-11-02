/** Admin home helpers. Pure: "today" is a YYYY-MM-DD string in the club's timezone. */
export type DueLite = { membershipId: string; status: string; dueDate: string };

export type MembershipOverview = { paid: number; unpaid: number; expiring: number; active: number; total: number };

const DAY = 86_400_000;
const day = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return Date.UTC(y!, m! - 1, d!); };

/**
 * One state per member, from their LATEST due:
 * - unpaid: latest due is due/overdue and its date is today or earlier (or status overdue)
 * - expiring: latest due is paid and the NEXT cycle is not billed, or an unpaid due falls within `windowDays`
 * - paid: everything else with a paid latest due
 * Members with no due at all are not counted. `active` = paid + expiring (not currently behind).
 * "Expiring" is only a claim about dues we hold: a paid due whose date is within the window is the end of that paid period.
 */
export function membershipOverview(dues: DueLite[], today: string, windowDays = 14): MembershipOverview {
  const latest = new Map<string, DueLite>();
  for (const d of dues) {
    const cur = latest.get(d.membershipId);
    if (!cur || day(d.dueDate) > day(cur.dueDate)) latest.set(d.membershipId, d);
  }
  const t = day(today);
  let paid = 0, unpaid = 0, expiring = 0;
  for (const d of latest.values()) {
    const away = Math.round((day(d.dueDate) - t) / DAY);
    if (d.status === "paid" || d.status === "waived") (away >= 0 && away <= windowDays ? expiring++ : paid++);
    else if (d.status === "overdue" || away <= 0) unpaid++;
    else if (away <= windowDays) expiring++;
    else paid++;
  }
  return { paid, unpaid, expiring, active: paid + expiring, total: latest.size };
}

export type Activity = { id: string; kind: "member" | "payment" | "result"; at: Date; title: string; detail?: string; href?: string };

/** Merge feeds newest first, dropping duplicate ids, capped at `limit`. */
export function mergeActivity(feeds: Activity[][], limit = 8): Activity[] {
  const seen = new Set<string>();
  return feeds.flat().sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id))
    .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).slice(0, limit);
}
