import type { VerifiedTransaction } from "./types";

export type Reconciliation = { ok: true } | { ok: false; reason: "not_successful" | "amount_mismatch" | "currency_mismatch" | "reference_mismatch" };

/**
 * Never credit a payment because a webhook or return URL says so. Credit it only when the provider
 * confirms success AND the reference, amount and currency match what WE recorded before the customer paid.
 */
export function reconcile(expected: { reference: string; amountKobo: number; currency?: string }, verified: VerifiedTransaction): Reconciliation {
  if (verified.reference !== expected.reference) return { ok: false, reason: "reference_mismatch" };
  if (verified.status !== "success") return { ok: false, reason: "not_successful" };
  if (verified.currency !== (expected.currency ?? "NGN")) return { ok: false, reason: "currency_mismatch" };
  if (!Number.isInteger(verified.amountKobo) || verified.amountKobo !== expected.amountKobo) return { ok: false, reason: "amount_mismatch" };
  return { ok: true };
}
