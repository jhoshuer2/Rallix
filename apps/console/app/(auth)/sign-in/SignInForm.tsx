"use client";
import { useState } from "react";
import { normalizePhone } from "@rallix/config/phone";
import { authClient } from "../../../lib/auth-client";

export function SignInForm({ denied }: { denied: boolean }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(denied ? "That account is not on the platform team." : undefined);
  const [busy, setBusy] = useState(false);
  const e164 = normalizePhone(phone);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!e164) return setError("Enter a valid Nigerian phone number.");
    setError(undefined); setBusy(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: e164 });
    setBusy(false);
    if (error) return setError(error.message ?? "Could not send the code.");
    setStep("code");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setError(undefined); setBusy(true);
    const { error } = await authClient.phoneNumber.verify({ phoneNumber: e164!, code, disableSession: false });
    if (error) { setBusy(false); return setError(error.message ?? "That code didn’t work."); }
    window.location.assign("/");
  }

  return (
    <main className="cs-signin">
      <form noValidate onSubmit={step === "phone" ? send : verify} className="cs-card" style={{ width: "min(420px, 100%)" }}>
        <p className="cs-eyebrow">Rallix</p>
        <h1 className="cs-h1">Console sign in</h1>
        <p className="cs-muted">Platform team only. We’ll text you a 6-digit code.</p>
        {step === "phone" ? (
          <label className="cs-field"><span>Phone number</span>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        ) : (
          <label className="cs-field"><span>6-digit code sent to {e164}</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
        )}
        {error ? <p role="alert" className="cs-error">{error}</p> : null}
        <button type="submit" className="cs-btn" disabled={busy}>{busy ? "Please wait…" : step === "phone" ? "Send code" : "Sign in"}</button>
      </form>
    </main>
  );
}
