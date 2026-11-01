"use client";
import { useEffect, useState } from "react";
import { isEmail } from "@rallix/mailer/validate";
import { authClient } from "../../../lib/auth-client";

const COOLDOWN = 60;

export function SignInForm({ denied }: { denied: boolean }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(denied ? "That account is not on the platform team." : undefined);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const address = email.trim().toLowerCase();

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isEmail(address)) return setError("Enter a valid email address.");
    setError(undefined); setBusy(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" });
    setBusy(false);
    if (error) return setError(error.status === 429 ? "Too many tries. Wait a minute and try again." : "Could not send a code. Try again.");
    setCode(""); setStep("code"); setWait(COOLDOWN);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setError(undefined); setBusy(true);
    const { error } = await authClient.signIn.emailOtp({ email: address, otp: code });
    if (error) { setBusy(false); return setError(error.status === 429 ? "Too many tries. Wait a minute and try again." : "That code didn’t work."); }
    window.location.assign("/");
  }

  return (
    <main className="cs-signin">
      <form noValidate onSubmit={step === "email" ? send : verify} className="cs-card" style={{ width: "min(420px, 100%)" }}>
        <p className="cs-eyebrow">Rallix</p>
        <h1 className="cs-h1">Console sign in</h1>
        <p className="cs-muted">{step === "email" ? "Platform team only. We’ll email you a 6-digit code." : `If ${address} is on the platform team, a code is on its way. It can take a minute.`}</p>
        {step === "email" ? (
          <label className="cs-field"><span>Work email</span><input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        ) : (
          <label className="cs-field"><span>6-digit code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
        )}
        {error ? <p role="alert" className="cs-error">{error}</p> : null}
        <button type="submit" className="cs-btn" disabled={busy}>{busy ? "Please wait…" : step === "email" ? "Email me a code" : "Sign in"}</button>
        {step === "code" ? (
          <div className="cs-actions" style={{ marginTop: 12 }}>
            <button type="button" className="cs-btn cs-btn--ghost" disabled={busy || wait > 0} onClick={() => send()}>{wait > 0 ? `New code in ${wait}s` : "Send a new code"}</button>
            <button type="button" className="cs-btn cs-btn--ghost" onClick={() => { setStep("email"); setCode(""); setError(undefined); }}>Different email</button>
          </div>
        ) : null}
      </form>
    </main>
  );
}
