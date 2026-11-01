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
