import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Unguessable, URL-safe transaction reference. D = player dues, I = Rallix invoice. */
export function generateReference(kind: "D" | "I"): string {
  const bytes = randomBytes(20);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `RLX-${kind}-${s}`;
}
export const referenceKind = (ref: string): "due" | "invoice" | null => (/^RLX-D-[A-Z0-9]{20}$/.test(ref) ? "due" : /^RLX-I-[A-Z0-9]{20}$/.test(ref) ? "invoice" : null);

const TOKEN_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // 54 symbols, no look-alikes (0/O, 1/l/I)
/** Unguessable token for a public pay link: 24 chars x log2(54) ~ 138 bits. Uses rejection sampling so every symbol is equally likely. */
export function generatePayToken(length = 24): string {
  const limit = 256 - (256 % TOKEN_CHARS.length);
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit && out.length < length) out += TOKEN_CHARS[b % TOKEN_CHARS.length];
    }
  }
  return out;
}
/** Cheap shape check done BEFORE any database lookup, so garbage never reaches the query. */
export const isPayTokenShape = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9]{24,64}$/.test(t);
