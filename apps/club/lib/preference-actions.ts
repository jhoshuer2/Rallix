"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { users } from "@rallix/db";
import { getCtx } from "./context";
import { serviceDb } from "./db";
import { userFromToken } from "./unsubscribe";

type Res = { ok: true } | { ok: false; error: string };

/** Unsubscribe (or resubscribe) from the page a footer link opens. The signed token is the only credential needed. */
export async function setOptOutByToken(token: string, optOut: boolean): Promise<Res> {
  const userId = userFromToken(token);
  if (!userId) return { ok: false, error: "This link isn’t valid." };
  await serviceDb().update(users).set({ emailOptOut: optOut }).where(eq(users.id, userId));
  return { ok: true };
}

/** The same switch for a signed-in person, on their Me or Profile page. Uses only the id from their session. */
export async function setEmailOptOut(optOut: boolean): Promise<Res> {
  const ctx = await getCtx();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  await serviceDb().update(users).set({ emailOptOut: optOut }).where(eq(users.id, ctx.user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
