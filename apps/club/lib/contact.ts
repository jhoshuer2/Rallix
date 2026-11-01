import { eq } from "drizzle-orm";
import { users } from "@rallix/db";
import { serviceDb } from "./db";

/** The signed-in user's own phone. Only ever called with the id from their session: the app role cannot read phones. */
export async function ownPhone(userId: string): Promise<string> {
  const [u] = await serviceDb().select({ phone: users.phoneNumber }).from(users).where(eq(users.id, userId));
  return u?.phone ?? "";
}
