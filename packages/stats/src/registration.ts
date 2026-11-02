/** Competition sign-up rules for the preview page. Pure: dates are plain YYYY-MM-DD strings in the club's timezone. */
export type RegistrationInput = {
  status: "draft" | "active" | "completed" | "cancelled";
  openRegistration: boolean;
  maxPlayers: number | null;
  entries: number;
  closesOn: string | null;
  today: string;
  registered: boolean;
  /** null = open to every level */
  level: string | null;
  myLevel: string | null;
};

export type RegistrationState = "join" | "registered" | "full" | "closed" | "wrong_level" | "hidden";

/**
 * What the one main button on a competition preview should do.
 * - A draft with registration off is hidden from players.
 * - Anyone already entered stays "registered" (they may still leave while it is a draft).
 * - Otherwise: not a draft, or past the closing date => closed; wrong level => wrong_level; no spots left => full; else join.
 * The database function app.join_competition applies the same rules and is the authority.
 */
export function registrationState(i: RegistrationInput): RegistrationState {
  if (i.status === "draft" && !i.openRegistration) return "hidden";
  if (i.registered) return "registered";
  if (i.status !== "draft" || !i.openRegistration) return "closed";
  if (i.closesOn && i.today > i.closesOn) return "closed";
  if (i.level && i.myLevel !== i.level) return "wrong_level";
  if (i.maxPlayers !== null && i.entries >= i.maxPlayers) return "full";
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
