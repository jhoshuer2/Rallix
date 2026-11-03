/** What an admin can look after. The club owner always has all of them. Keep in step with app.has_permission in the database. */
export const PERMISSIONS = [
  { key: "members", title: "Members", hint: "Invites, applications, member profiles and the club page." },
  { key: "competitions", title: "Competitions", hint: "Create competitions, run the draw and record results." },
  { key: "finance", title: "Finance", hint: "Fees, payments, payouts and reminders." },
  { key: "facilities", title: "Facilities", hint: "The court, check-in and, soon, tables, bats and balls." },
] as const;
export type Permission = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map((p) => p.key);
