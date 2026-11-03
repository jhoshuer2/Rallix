/** Pure member-limit rules for the club app. The database trigger is the lock; this only drives the words and the "nearly full" nudge. */
export type LimitState = { limit: number | null; members: number; left: number | null; full: boolean; nearing: boolean };

/** `nearing` = five places or fewer are left (and not full). No limit means never full. */
export function memberLimitState(members: number, limit: number | null): LimitState {
  if (limit === null) return { limit, members, left: null, full: false, nearing: false };
  const left = Math.max(0, limit - members);
  return { limit, members, left, full: left === 0, nearing: left > 0 && left <= 5 };
}

/** "45 of 50 members", or null when there is no limit. */
export const limitLabel = (s: LimitState): string | null => (s.limit === null ? null : `${s.members} of ${s.limit} members`);
