/**
 * Dues reminder scheduling, as pure functions. Days are whole days relative to the due date:
 * negative = before it is due, 0 = on the day, positive = after (overdue).
 */
export const DEFAULT_OFFSETS = [-3, 0, 3, 7] as const;
export const OFFSET_CHOICES = [-7, -3, -1, 0, 1, 3, 7, 14] as const;
export const MIN_OFFSET = -14, MAX_OFFSET = 30, MAX_REMINDERS = 6;
/** A reminder missed because the job didn't run (an outage) is still sent for this many days after it was due, then skipped. */
export const GRACE_DAYS = 2;

export type OffsetsCheck = { ok: true; offsets: number[] } | { ok: false; error: string };

/** Validate and normalise a club's chosen offsets: whole numbers in range, unique, at most six, sorted. */
export function checkOffsets(input: unknown): OffsetsCheck {
  if (!Array.isArray(input)) return { ok: false, error: "Choose when reminders are sent." };
  if (input.length === 0) return { ok: false, error: "Choose at least one day, or turn reminders off." };
  if (input.length > MAX_REMINDERS) return { ok: false, error: `Choose at most ${MAX_REMINDERS} reminder days.` };
  for (const v of input) if (typeof v !== "number" || !Number.isInteger(v) || v < MIN_OFFSET || v > MAX_OFFSET) return { ok: false, error: `Reminder days must be whole numbers from ${MIN_OFFSET} to ${MAX_OFFSET}.` };
  return { ok: true, offsets: [...new Set(input as number[])].sort((a, b) => a - b) };
}

const DAY = 86_400_000;
/** Whole days from a to b for YYYY-MM-DD strings, ignoring time zones and daylight saving. */
export function daysBetween(a: string, b: string): number {
  const pa = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)), pb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((pb - pa) / DAY);
}

/**
 * Which reminder, if any, should go out for one unpaid due today?
 *  - A reminder is due once `today >= dueDate + offset`, and stays eligible for GRACE_DAYS.
 *  - If several are eligible only the LATEST is sent (never a burst of old ones after an outage).
 *  - Offsets already sent are never repeated.
 * Returns the offset to send, or null.
 */
export function nextReminder(o: { dueDate: string; today: string; offsets: readonly number[]; alreadySent: ReadonlySet<number>; grace?: number }): number | null {
  const daysPastDue = daysBetween(o.dueDate, o.today); // negative while the due date is still ahead
  const grace = o.grace ?? GRACE_DAYS;
  const eligible = [...o.offsets].filter((off) => daysPastDue >= off && daysPastDue - off <= grace).sort((a, b) => b - a);
  const latest = eligible[0];
  if (latest === undefined) return null;
  return o.alreadySent.has(latest) ? null : latest;
}

/** The phrase used in the email: "are due in 3 days", "are due today", "were due 3 days ago". */
export function timingPhrase(offset: number): string {
  if (offset < -1) return `are due in ${-offset} days`;
  if (offset === -1) return "are due tomorrow";
  if (offset === 0) return "are due today";
  if (offset === 1) return "were due yesterday";
  return `were due ${offset} days ago`;
}

/** Human description for the settings screen. */
export const describeOffset = (offset: number) => (offset < -1 ? `${-offset} days before` : offset === -1 ? "The day before" : offset === 0 ? "On the due date" : offset === 1 ? "1 day after" : `${offset} days after`);
