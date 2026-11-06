"use client";
import { useEffect, useState } from "react";
import { Button, EntryShell, PasswordField, TextField } from "@rallix/ui";
import { isEmail } from "@rallix/mailer/validate";
import { authClient } from "../../../lib/auth-client";

const COOLDOWN = 60;

export function SignInForm({ next, initialMethod = "code" }: { next: string; initialMethod?: "code" | "password" }) {
  const [method, setMethod] = useState<"code" | "password">(initialMethod);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const address = email.trim().toLowerCase();

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isEmail(address)) return setError("Enter a valid email address, like ade@example.com");
    setError(undefined); setBusy(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" });
    setBusy(false);
    if (error) return setError(error.status === 429 ? "Too many tries. Please wait a minute and try again." : error.status === 403 ? "This address isn’t allowed to sign in. Open the app from the link your club shared, or from rallix.ng, and try again." : "We couldn’t send a code. Please try again in a minute.");
    setCode(""); setStep("code"); setWait(COOLDOWN);
  }
  /** One field for a username or an email: an @ means email. The same plain message for every failure, so it never says which accounts exist. */
  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    const who = login.trim().toLowerCase();
    if (!who || !password) return setError("Enter your username or email, and your password.");
    setError(undefined); setBusy(true);
    const { error } = who.includes("@") ? await authClient.signIn.email({ email: who, password }) : await authClient.signIn.username({ username: who, password });
    if (error) { setBusy(false); return setError(error.status === 429 ? "Too many tries. Please wait a minute and try again." : "That username, email or password didn’t work. You can also sign in with an emailed code."); }
    window.location.assign(next);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your email");
    setError(undefined); setBusy(true);
    const { error } = await authClient.signIn.emailOtp({ email: address, otp: code });
    if (error) { setBusy(false); return setError(error.status === 429 ? "Too many tries. Please wait a minute and try again." : "That code didn’t work. Check it, or ask for a new one."); }
    window.location.assign(next);
  }

  if (method === "password") {
    return (
      <EntryShell title="Sign in to Rallix" subtitle="Use your username or email and your password.">
        <form noValidate onSubmit={signInWithPassword}>
          <TextField label="Username or email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={login} onChange={(e) => setLogin(e.target.value)} />
          <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
          <Button type="submit" block disabled={busy}>{busy ? "Please wait…" : "Sign in"}</Button>
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            <Button type="button" variant="ghost" block onClick={() => { setMethod("code"); setError(undefined); }}>Email me a code instead</Button>
          </div>
        </form>
      </EntryShell>
    );
  }

  return (
    <EntryShell title="Sign in to Rallix" subtitle={step === "email" ? "We’ll email you a 6-digit code. No password needed." : `If ${address} can sign in, a code is on its way. It can take a minute, and check your spam folder.`}>
      <form noValidate onSubmit={step === "email" ? send : verify}>
        {step === "email" ? (
          <TextField label="Email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        ) : (
          <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} error={error} />
        )}
        <Button type="submit" block disabled={busy}>{busy ? "Please wait…" : step === "email" ? "Email me a code" : "Sign in"}</Button>
        {step === "email" ? <div style={{ marginTop: 16 }}><Button type="button" variant="ghost" block onClick={() => { setMethod("password"); setError(undefined); }}>Sign in with a password</Button></div> : null}
        {step === "email" ? <p className="rx-muted" style={{ margin: "16px 0 0", fontSize: 14 }}>New here? Sign in with your email and we will help you create your club, or open the invite link your club sent you.</p> : null}
        {step === "code" ? (
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            <Button type="button" variant="ghost" block disabled={busy || wait > 0} onClick={() => send()}>{wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</Button>
            <Button type="button" variant="ghost" block onClick={() => { setStep("email"); setCode(""); setError(undefined); }}>Use a different email</Button>
          </div>
        ) : null}
      </form>
    </EntryShell>
  );
}
