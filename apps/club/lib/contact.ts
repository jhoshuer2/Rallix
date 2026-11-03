import { eq } from "drizzle-orm";
import { users } from "@rallix/db";
import { normalizePhone } from "@rallix/config/phone";
import { serviceDb } from "./db";

/** The signed-in user's own phone. Only ever called with the id from their session: the app role cannot read phones. */
export async function ownPhone(userId: string): Promise<string> {
  const [u] = await serviceDb().select({ phone: users.phoneNumber }).from(users).where(eq(users.id, userId));
  return u?.phone ?? "";
}

/** Whether this person turned off optional emails. Only ever called with the id from their own session. */
export async function ownEmailOptOut(userId: string): Promise<boolean> {
  const [u] = await serviceDb().select({ out: users.emailOptOut }).from(users).where(eq(users.id, userId));
  return !!u?.out;
}

/**
 * Save the optional phone number for the signed-in user. The app role cannot read or write phone numbers (so club-mates
 * can't see each other's), so this uses the service role, scoped strictly to the user id from the session.
 * Returns an error message, or null when saved or when no number was given.
 */
export async function savePhone(userId: string, raw: string | undefined): Promise<string | null> {
  const input = (raw ?? "").trim();
  if (!input) return null;
  const phone = normalizePhone(input);
  if (!phone) return "Enter a valid Nigerian phone number, like 0803 000 0000, or leave it blank.";
  try { await serviceDb().update(users).set({ phoneNumber: phone, phoneNumberVerified: false }).where(eq(users.id, userId)); return null; }
  catch (e) { return ((e as { cause?: { code?: string }; code?: string })?.cause?.code ?? (e as { code?: string })?.code) === "23505" ? "That phone number is already used by another account." : "Could not save the phone number."; }
}

