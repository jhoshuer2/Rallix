import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EntryShell } from "@rallix/ui";
import { and, eq, inArray } from "drizzle-orm";
import { invoicePayments, memberships, payments } from "@rallix/db";
import { referenceKind } from "@rallix/payments";
import { getCtx } from "../../../../lib/context";
import { serviceDb } from "../../../../lib/db";
import { finalizeByReference, logEvent } from "../../../../lib/payments-core";
import { naira } from "../../../../lib/queries";

export const dynamic = "force-dynamic";
const MAX_CHECKS = 10;

/** Where the customer lands after Paystack. The URL is not trusted: we confirm with the provider before saying anything is paid. */
export default async function PayReturn({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string; n?: string }> }) {
  const sp = await searchParams;
  const reference = sp.reference ?? sp.trxref ?? "";
  const kind = referenceKind(reference);
  if (!kind) notFound();
  const ctx = await getCtx();
  if (!ctx) redirect(`/sign-in?next=${encodeURIComponent(`/pay/return?reference=${reference}`)}`);
  const db = serviceDb();

  // Only the person who started this payment (or an admin of the club, for invoices) may see its status.
  let amountKobo = 0, back = "/";
  if (kind === "due") {
    const [row] = await db.select({ amount: payments.amountKobo }).from(payments).innerJoin(memberships, eq(memberships.id, payments.membershipId))
      .where(and(eq(payments.providerRef, reference), eq(memberships.userId, ctx.user.id)));
    if (!row) notFound();
    amountKobo = row.amount; back = "/play/me/payments";
  } else {
    const adminClubs = ctx.clubs.filter((c) => c.roles.includes("admin")).map((c) => c.clubId);
    const [row] = adminClubs.length ? await db.select({ amount: invoicePayments.amountKobo }).from(invoicePayments).where(and(eq(invoicePayments.reference, reference), inArray(invoicePayments.clubId, adminClubs))) : [];
    if (!row) notFound();
    amountKobo = row.amount; back = "/membership/rallix";
  }

  let result; try { result = await finalizeByReference(reference); } catch { result = { outcome: "still_pending" as const, kind }; }
  await logEvent({ event: "return.verify", reference, signatureValid: true, outcome: result.outcome, detail: result.detail });
  const n = Math.min(MAX_CHECKS, Number(sp.n ?? 0) || 0);
  const o = result.outcome;
  const paid = o === "credited" || o === "already_processed" || o === "duplicate_payment";
  const waiting = o === "still_pending" && n < MAX_CHECKS;

  return (
    <EntryShell title={paid ? "Payment received" : waiting ? "Confirming your payment…" : o === "still_pending" ? "Still waiting for confirmation" : "Payment not completed"}>
      {waiting ? <meta httpEquiv="refresh" content={`3;url=/pay/return?reference=${reference}&n=${n + 1}`} /> : null}
      <p role="status" aria-live="polite" style={{ marginTop: 0, marginBottom: 24 }}>
        {paid ? `Thank you. ${naira(amountKobo)} has been recorded.${o === "duplicate_payment" ? " This was already marked as paid, so your admin has been flagged to refund the extra payment." : ""}`
          : waiting ? "This usually takes a few seconds. Please don’t pay again."
          : o === "still_pending" ? "We haven’t heard back from the payment provider yet. If money left your account, it will show here once it is confirmed. Please don’t pay again."
          : o === "failed" ? "The payment didn’t go through and you weren’t charged. You can try again."
          : o === "rejected_mismatch" ? "We couldn’t confirm this payment. If you were charged, contact your club admin. We’ve logged it for review."
          : "We couldn’t find that payment."}
      </p>
      <Link className="rx-btn rx-btn--block" href={back}>{kind === "due" ? "Back to my payments" : "Back to my club"}</Link>
    </EntryShell>
  );
}
