"use client";
import { useState } from "react";
import { Button, TextField } from "@rallix/ui";
import { authClient } from "../../../lib/auth-client";
import { normalizePhone } from "@rallix/config/phone";

export function SignInForm({ next }: { next: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const e164 = normalizePhone(phone);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!e164) return setError("Enter a valid Nigerian phone number, like 0803 000 0000");
    setError(undefined); setBusy(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: e164 });
    setBusy(false);
    if (error) return setError(error.message ?? "Could not send the code. Try again.");
    setStep("code");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    setError(undefined); setBusy(true);
    const { error } = await authClient.phoneNumber.verify({ phoneNumber: e164!, code });
    if (error) { setBusy(false); return setError(error.message ?? "That code didn’t work. Try again."); }
    window.location.assign(next);
  }

  return (
    <form noValidate onSubmit={step === "phone" ? send : verify} style={{ paddingTop: 48 }}>
      <h1 className="rx-title" style={{ marginBottom: 8 }}>Sign in to Rallix</h1>
      <p className="rx-muted" style={{ marginBottom: 24 }}>{step === "phone" ? "We’ll text you a 6-digit code." : `Enter the code we sent to ${e164}.`}</p>
      {step === "phone" ? (
        <TextField label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} error={error} />
      ) : (
        <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} error={error} />
      )}
      <Button type="submit" variant="surface" block disabled={busy}>{busy ? "Please wait…" : step === "phone" ? "Send code" : "Sign in"}</Button>
      {step === "code" ? <p style={{ marginTop: 16 }}><button type="button" className="rx-btn rx-btn--ghost" onClick={() => { setStep("phone"); setCode(""); setError(undefined); }}>Use a different number</button></p> : null}
    </form>
  );
}
