/** Competition sign-up rules for the preview page. Pure: dates are plain YYYY-MM-DD strings in the club's timezone. */
export type RegistrationInput = {
  status: "draft" | "active" | "completed" | "cancelled";
  openRegistration: boolean;
  maxPlayers: number | null;
  entries: number;
  closesOn: string | null;
  today: string;
  registered: boolean;
  /** On the waitlist for this competition. */
  waiting?: boolean;
  /** null = open to every level */
  level: string | null;
  myLevel: string | null;
};

export type RegistrationState = "join" | "registered" | "waitlist" | "waiting" | "closed" | "wrong_level" | "hidden";

/**
 * What the one main button on a competition preview should do.
 * - A draft with registration off is hidden from players.
 * - Anyone already entered stays "registered" (they may still leave while it is a draft).
 * - Otherwise: not a draft, or past the closing date => closed; wrong level => wrong_level; no spots left => waitlist (or waiting, if already in line); else join.
 * The database function app.join_competition applies the same rules and is the authority.
 */
export function registrationState(i: RegistrationInput): RegistrationState {
  if (i.status === "draft" && !i.openRegistration) return "hidden";
  if (i.registered) return "registered";
  if (i.status !== "draft" || !i.openRegistration) return "closed";
  if (i.closesOn && i.today > i.closesOn) return "closed";
  if (i.level && i.myLevel !== i.level) return "wrong_level";
  if (i.maxPlayers !== null && i.entries >= i.maxPlayers) return i.waiting ? "waiting" : "waitlist";
  return "join";
}

/** "24 of 32 spots", or "24 registered" when there is no limit. */
export function spotsLabel(entries: number, max: number | null): string {
  return max === null ? `${entries} registered` : `${entries} of ${max} spots`;
}

/** 0 to 100 for the thin spots bar. No limit means no bar. */
export function spotsPercent(entries: number, max: number | null): number | null {
  return max === null || max <= 0 ? null : Math.min(100, Math.round((entries / max) * 100));
}

/** Players can see a competition if it is running or finished, or it is a draft that is open for sign-up. Admins always can. */
export const visibleToPlayers = (status: string, openRegistration: boolean) => status === "active" || status === "completed" || (status === "draft" && openRegistration);

/** Your place in the queue (1 = next), by who joined first. Null when you are not in line. */
export function waitlistPosition(waiters: Array<{ id: string; at: string | Date }>, me: string): number | null {
  const sorted = [...waiters].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || a.id.localeCompare(b.id));
  const i = sorted.findIndex((w) => w.id === me);
  return i < 0 ? null : i + 1;
}

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** The short line under the button: "3 spots left", "Full", or "24 registered". */
export function spotsLeftLabel(entries: number, max: number | null): string | null {
  if (max === null) return null;
  const left = Math.max(0, max - entries);
  return left === 0 ? "Full" : `${left} ${left === 1 ? "spot" : "spots"} left`;
}
