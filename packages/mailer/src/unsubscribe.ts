import { createHmac, timingSafeEqual } from "node:crypto";
import { MailError } from "./types";

/**
 * Signed, non-expiring unsubscribe token for one user: base64url(userId) + "." + base64url(HMAC-SHA256(secret, "unsub:" + userId)).
 * Anyone holding the link can unsubscribe THAT user (and only that), which is the standard trade-off for one-click unsubscribe.
 * The "unsub:" prefix means a token can never be reused for another purpose that signs a user id with the same secret.
 */
const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export function signUnsubscribeToken(secret: string, userId: string): string {
  if (!secret || secret.length < 16) throw new MailError("UNSUBSCRIBE_SECRET must be at least 16 characters", "config");
  if (!userId || userId.length > 200) throw new MailError("Invalid user id");
  return `${b64(userId)}.${b64(createHmac("sha256", secret).update(`unsub:${userId}`).digest())}`;
}

/** Returns the user id if the token is genuine, otherwise null. Never throws on garbage input. */
export function verifyUnsubscribeToken(secret: string, token: unknown): string | null {
  if (typeof token !== "string" || token.length > 600 || !secret) return null;
  const [idPart, sigPart, extra] = token.split(".");
  if (!idPart || !sigPart || extra !== undefined) return null;
  let userId: string, given: Buffer;
  try { userId = Buffer.from(idPart, "base64url").toString("utf8"); given = Buffer.from(sigPart, "base64url"); } catch { return null; }
  if (!userId || userId.length > 200 || b64(userId) !== idPart) return null;
  const expected = createHmac("sha256", secret).update(`unsub:${userId}`).digest();
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
