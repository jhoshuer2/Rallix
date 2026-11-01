"use client";
import { useState } from "react";
import { Button } from "@rallix/ui";
import { startInvoicePayment } from "../../../../lib/payment-actions";

export function PayInvoiceButton({ invoiceId, amount }: { invoiceId: string; amount: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <>
      <Button block disabled={busy} onClick={async () => { setBusy(true); setError(undefined); const r = await startInvoicePayment(invoiceId); if (r.ok) window.location.assign(r.url); else { setBusy(false); setError(r.error); } }}>{busy ? "Opening secure checkout…" : `Pay ${amount}`}</Button>
      {error ? <p role="alert" className="rx-error" style={{ color: "#8a1c00", marginTop: 8 }}>{error}</p> : null}
    </>
  );
}
