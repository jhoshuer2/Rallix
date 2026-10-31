import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { platformAdmins, users } from "@rallix/db";
import { auth } from "./auth";
import { db } from "./db";

export type Staff = { id: string; name: string; phone: string | null };

/** The signed-in staff member, or null. Being signed in is not enough: the user must be on platform_admins. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const s = await auth().api.getSession({ headers: await headers() });
  if (!s) return null;
  const [row] = await db().select({ id: users.id, name: users.name, phone: users.phoneNumber }).from(platformAdmins)
    .innerJoin(users, eq(users.id, platformAdmins.userId)).where(eq(platformAdmins.userId, s.user.id)).limit(1);
  return row ?? null;
});

/** Guard for every page and action. Redirects to the sign-in page when not authorised. */
export async function requireAdmin(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/sign-in?denied=1");
  return staff;
}
