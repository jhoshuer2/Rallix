import type { Metadata } from "next";
import { EntryShell } from "@rallix/ui";
import { referenceKind } from "@rallix/payments";
import { finalizeByReference, logEvent } from "../../../../../../lib/payments-core";
import { lookupPayLink, referenceBelongsToToken } from "../../../../../../lib/pay-link";
import { naira } from "../../../../../../lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment status", robots: { index: false, follow: false, nocache: true } };
const MAX_CHECKS = 10;

/** Landing page after paying from a link. The reference must belong to THIS token's invoice, so a token cannot be used to probe other payments. */
export default async function PayLinkReturn({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ reference?: string; trxref?: string; n?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const reference = sp.reference ?? sp.trxref ?? "";
  const generic = <EntryShell title="Link not valid"><p style={{ marginTop: 0 }}>We couldn’t find that payment. Please contact Rallix.</p></EntryShell>;
  if (referenceKind(reference) !== "invoice" || !(await referenceBelongsToToken(reference, token))) return generic;
  const v = await lookupPayLink(token);

  let result; try { result = await finalizeByReference(reference); } catch { result = { outcome: "still_pending" as const, kind: "invoice" as const }; }
  await logEvent({ event: "return.verify", reference, signatureValid: true, outcome: result.outcome, detail: result.detail });
  const n = Math.min(MAX_CHECKS, Number(sp.n ?? 0) || 0);
  const o = result.outcome;
  const paid = o === "credited" || o === "already_processed" || o === "duplicate_payment";
  const waiting = o === "still_pending" && n < MAX_CHECKS;
  return (
    <EntryShell title={paid ? "Payment received" : waiting ? "Confirming your payment…" : o === "still_pending" ? "Still waiting for confirmation" : "Payment not completed"}>
      {waiting ? <meta httpEquiv="refresh" content={`3;url=/pay/invoice/${token}/return?reference=${reference}&n=${n + 1}`} /> : null}
      <p role="status" aria-live="polite" style={{ marginTop: 0, marginBottom: 24 }}>
        {paid ? `Thank you. ${naira(v.amountKobo ?? 0)} for ${v.clubName ?? "your club"} (${v.number}) has been received. If your club was suspended for non-payment, access returns automatically.`
          : waiting ? "This usually takes a few seconds. Please don’t pay again."
          : o === "still_pending" ? "We haven’t heard back from the payment provider yet. If money left your account it will be recorded once confirmed. Please don’t pay again."
          : o === "failed" ? "The payment didn’t go through and you weren’t charged. Open your link again to retry."
          : "We couldn’t confirm this payment. If you were charged, please contact Rallix with your invoice number."}
      </p>
      {!paid ? <a className="rx-btn rx-btn--block" href={`/pay/invoice/${token}`}>Back to the invoice</a> : null}
    </EntryShell>
  );
}
