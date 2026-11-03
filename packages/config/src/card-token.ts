import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Member card QR tokens. A token proves "this phone belongs to membership M of club C right now": it is an HMAC over the
 * membership, the club and the current minute, so a screenshot stops working after about two minutes. The signing key is
 * derived from a server secret with a fixed label, so it cannot be mistaken for any other token in the app.
 */
const WINDOW_MS = 60_000;
export const CARD_VALID_WINDOWS = 2; // the current minute and the one before it
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const key = (secret: string) => createHmac("sha256", secret).update("rallix:member-card:v1").digest();
const mac = (secret: string, club: string, member: string, window: number) =>
  createHmac("sha256", key(secret)).update(`${club}.${member}.${window}`).digest("base64url").slice(0, 22);

export function signCardToken(secret: string, club: string, member: string, now: Date = new Date()): string {
  if (!secret || secret.length < 16) throw new Error("card secret missing or too short");
  if (!ID.test(club) || !ID.test(member)) throw new Error("bad ids");
  const w = Math.floor(now.getTime() / WINDOW_MS);
  return `rx1.${club}.${member}.${w.toString(36)}.${mac(secret, club, member, w)}`;
}

/** The club and membership a valid, fresh token names, or null. Never throws on garbage. */
export function verifyCardToken(secret: string, token: unknown, now: Date = new Date()): { club: string; member: string } | null {
  if (typeof token !== "string" || token.length > 200 || !secret || secret.length < 16) return null;
  const p = token.split(".");
  if (p.length !== 5 || p[0] !== "rx1") return null;
  const [, club, member, w36, sig] = p as [string, string, string, string, string];
  if (!ID.test(club) || !ID.test(member) || !/^[0-9a-z]{1,10}$/.test(w36)) return null;
  const w = parseInt(w36, 36), cur = Math.floor(now.getTime() / WINDOW_MS);
  if (!Number.isFinite(w) || w > cur || cur - w >= CARD_VALID_WINDOWS) return null;
  const want = Buffer.from(mac(secret, club, member, w)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return { club, member };
}
