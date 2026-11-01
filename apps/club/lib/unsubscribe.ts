import { signUnsubscribeToken, verifyUnsubscribeToken } from "@rallix/mailer";
import { appUrl } from "./payments";

/** Shared by both apps. In production it must be set; development has a fixed fallback so nothing breaks locally. */
export function unsubscribeSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("UNSUBSCRIBE_SECRET is not set (at least 16 characters, identical in the club app and console)");
  return "dev-only-unsubscribe-secret-not-for-production";
}
export const unsubscribeToken = (userId: string) => signUnsubscribeToken(unsubscribeSecret(), userId);
export const userFromToken = (token: unknown) => verifyUnsubscribeToken(unsubscribeSecret(), token);
/** The page a person opens from the footer link (asks to confirm, so email scanners that open links can't unsubscribe anyone). */
export const unsubscribePageUrl = (userId: string) => `${appUrl()}/unsubscribe/${unsubscribeToken(userId)}`;
/** The URL mailbox providers POST to for one-click unsubscribe (RFC 8058). */
export const unsubscribeApiUrl = (userId: string) => `${appUrl()}/api/unsubscribe/${unsubscribeToken(userId)}`;
