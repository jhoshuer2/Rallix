import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA512 (hex) of the raw request body, keyed with the secret. This is how Paystack signs webhooks. */
export const signBody = (secret: string, rawBody: string) => createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");

export function verifySignature(secret: string, rawBody: string, signature: string | null | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(signBody(secret, rawBody), "hex");
  let given: Buffer;
  try { given = Buffer.from(signature.trim(), "hex"); } catch { return false; }
  // Different length means invalid (and timingSafeEqual would throw), so reject before comparing.
  return given.length === expected.length && timingSafeEqual(given, expected);
}
