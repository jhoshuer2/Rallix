"use client";
import { useState } from "react";
import { Button } from "@rallix/ui";
import { startDuePayment } from "../lib/payment-actions";

/** Starts a real checkout for one due. The amount is decided on the server, not here. */
export function PayButton({ dueId, amount, enabled }: { dueId: string; amount: string; enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!enabled) return <p className="rx-muted" style={{ margin: 0, fontSize: 14 }}>Your club hasn’t set up online payments yet. Please pay your club admin directly.</p>;
  return (
    <>
      <Button block disabled={busy} onClick={async () => {
        setBusy(true); setError(undefined);
        const r = await startDuePayment(dueId);
        if (r.ok) window.location.assign(r.url); else { setBusy(false); setError(r.error); }
      }}>{busy ? "Opening secure checkout…" : `Pay ${amount}`}</Button>
      {error ? <p role="alert" className="rx-error" style={{ color: "#8a1c00", marginTop: 8 }}>{error}</p> : null}
    </>
  );
}
