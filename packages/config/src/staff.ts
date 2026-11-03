/** What each kind of Rallix staff member may open and change in the console. Every console page and action names an area. */

export const STAFF_ROLES = ["owner", "admin", "finance", "support"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const AREAS = ["clubs", "clubs_manage", "billing", "support", "notifications", "templates", "audit", "team"] as const;
export type Area = (typeof AREAS)[number];

const ALLOWED: Record<StaffRole, readonly Area[]> = {
  owner: AREAS,
  admin: AREAS.filter((a) => a !== "team"),
  finance: ["clubs", "clubs_manage", "billing"],
  support: ["clubs", "support"],
};

export const isStaffRole = (v: unknown): v is StaffRole => typeof v === "string" && (STAFF_ROLES as readonly string[]).includes(v);

/** Unknown roles can do nothing (fail closed). */
export function staffCan(role: unknown, area: Area): boolean {
  return isStaffRole(role) && ALLOWED[role].includes(area);
}

export const ROLE_LABEL: Record<StaffRole, string> = { owner: "Owner", admin: "Admin", finance: "Finance", support: "Support" };
export const ROLE_HINT: Record<StaffRole, string> = {
  owner: "Everything, including the team",
  admin: "Everything except the team",
  finance: "Clubs, subscriptions, invoices and payments",
  support: "Issues and the support inbox; can look at clubs",
};
