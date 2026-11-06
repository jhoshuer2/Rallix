"use server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { users } from "@rallix/db";
import { checkPassword, checkUsername } from "@rallix/config/safe-input";
import { auth } from "./auth";
import { accountStatus } from "./account-queries";
import { getCtx } from "./context";
import { serviceDb } from "./db";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const pgCode = (e: unknown) => (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;

/**
 * Set or change the signed-in person's username and password. Optional for everyone: the emailed code always works.
 * First time: a username and a password together. Later: a new username, or a new password (which needs the current one).
 * Only ever acts on the caller's own account (the id comes from the session, never from the form).
 */
export async function saveCredentials(input: { username: string; password?: string; currentPassword?: string }): Promise<Result> {
  const ctx = await getCtx();
  if (!ctx) return fail("Please sign in again.");
  const name = checkUsername(input?.username);
  if (!name.ok) return fail(name.error);
  const status = await accountStatus(ctx.user.id);
  const wantsPassword = typeof input.password === "string" && input.password.length > 0;
  if (!status.hasPassword && !wantsPassword) return fail("Choose a password too, so you can sign in with your username.");
  if (wantsPassword) {
    const pw = checkPassword(input.password, { username: name.username, email: ctx.user.email });
    if (!pw.ok) return fail(pw.error);
    if (status.hasPassword && (typeof input.currentPassword !== "string" || input.currentPassword.length === 0)) return fail("Enter your current password to change it.");
  }

  try {
    await serviceDb().update(users).set({ username: name.username, displayUsername: name.username, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
  } catch (e) {
    if (pgCode(e) === "23505") return fail("That username is taken. Try another.");
    return fail("Could not save. Please try again.");
  }

  if (wantsPassword) {
    try {
      const h = await headers();
      if (status.hasPassword) await auth().api.changePassword({ headers: h, body: { currentPassword: input.currentPassword!, newPassword: input.password!, revokeOtherSessions: true } });
      else await auth().api.setPassword({ headers: h, body: { newPassword: input.password! } });
    } catch {
      return fail(status.hasPassword ? "Your current password isn’t right." : "Could not save the password. Please try again.");
    }
  }
  return { ok: true };
}
