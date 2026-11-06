import { and, eq } from "drizzle-orm";
import { accounts, users } from "@rallix/db";
import { serviceDb } from "./db";

/** Whether this person has set a username and password. Service role: the app role cannot read either. Called only with the signed-in user's own id. */
export async function accountStatus(userId: string): Promise<{ username: string | null; hasPassword: boolean }> {
  const db = serviceDb();
  const [u] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
  const [a] = await db.select({ password: accounts.password }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"))).limit(1);
  return { username: u?.username ?? null, hasPassword: !!a?.password };
}
