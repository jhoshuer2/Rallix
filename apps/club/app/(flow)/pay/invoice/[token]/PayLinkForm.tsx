"use client";
import { useState } from "react";
import { Button, TextField } from "@rallix/ui";
import { startInvoicePaymentByToken } from "../../../../../lib/payment-actions";

export function PayLinkForm({ token, amount }: { token: string; amount: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(undefined);
    const r = await startInvoicePaymentByToken(token, email);
    if (r.ok) window.location.assign(r.url); else { setBusy(false); setError(r.error); }
  }
  return (
    <form noValidate onSubmit={submit}>
      <TextField label="Email for your receipt (optional)" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      {error ? <p role="alert" className="rx-error" style={{ marginBottom: 16 }}>{error}</p> : null}
      <Button type="submit" variant="surface" block disabled={busy}>{busy ? "Opening secure checkout…" : `Pay ${amount}`}</Button>
      <p className="rx-muted" style={{ fontSize: 13, marginTop: 16 }}>You’ll pay on Paystack’s secure page. Rallix never sees your card details.</p>
    </form>
  );
}
