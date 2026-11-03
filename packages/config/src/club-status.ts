/** Which club status changes the console allows. A pending club is waiting for approval and can only be approved or declined. */
export type ClubStatus = "pending" | "active" | "suspended" | "closed";
export const CLUB_STATUSES: readonly ClubStatus[] = ["pending", "active", "suspended", "closed"];

const NEXT: Record<ClubStatus, readonly ClubStatus[]> = {
  pending: ["active", "closed"], // approve, or decline
  active: ["suspended", "closed"],
  suspended: ["active", "closed"],
  closed: ["active"],
};

export const isClubStatus = (v: unknown): v is ClubStatus => typeof v === "string" && (CLUB_STATUSES as readonly string[]).includes(v);

/** Can a club move from `from` to `to`? Unknown values and no-op changes are refused. */
export function canChangeClubStatus(from: unknown, to: unknown): boolean {
  return isClubStatus(from) && isClubStatus(to) && NEXT[from].includes(to);
}

/** The status a brand-new club gets. */
export const initialClubStatus = (approvalOn: boolean): ClubStatus => (approvalOn ? "pending" : "active");
