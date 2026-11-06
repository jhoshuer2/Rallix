"use client";
import { useState } from "react";
import { Button, TextField } from "@rallix/ui";
import { checkPassword, checkUsername } from "@rallix/config/safe-input";
import { saveCredentials } from "../lib/account-actions";

/** Optional username and password. The emailed code keeps working whatever is set here. */
export function AccountForm({ email, username, hasPassword }: { email: string; username: string | null; hasPassword: boolean }) {
  const [name, setName] = useState(username ?? "");
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState({ username, hasPassword });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = checkUsername(name);
    if (!n.ok) return setMsg({ ok: false, text: `Username: ${n.error}` });
    if (pw || !saved.hasPassword) {
      const p = checkPassword(pw, { username: n.username, email });
      if (!p.ok) return setMsg({ ok: false, text: `Password: ${p.error}` });
      if (pw !== again) return setMsg({ ok: false, text: "The two passwords don’t match." });
    }
    setBusy(true);
    const r = await saveCredentials({ username: n.username, password: pw || undefined, currentPassword: current || undefined });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setSaved({ username: n.username, hasPassword: saved.hasPassword || !!pw });
    setName(n.username); setCurrent(""); setPw(""); setAgain("");
    setMsg({ ok: true, text: "Saved. You can now sign in with your username or email and this password." });
  }

  return (
    <form noValidate onSubmit={submit}>
      <p className="rx-muted" style={{ margin: "0 0 12px" }}>Optional. You can always sign in with an emailed code instead. Forgot your password? Sign in with a code, then set a new one here. Usernames are 3 to 20 letters, numbers or underscores; passwords are at least 8 characters.</p>
      <TextField label="Username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="ade_player" value={name} onChange={(e) => setName(e.target.value)} />
      {saved.hasPassword ? <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /> : null}
      <TextField label={saved.hasPassword ? "New password (leave empty to keep it)" : "Password"} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {pw || !saved.hasPassword ? <TextField label="Type the password again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /> : null}
      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "rx-muted" : "rx-error"} style={{ marginBottom: 12 }}>{msg.text}</p> : null}
      <Button type="submit" block disabled={busy}>{busy ? "Saving…" : saved.hasPassword ? "Save changes" : "Save username and password"}</Button>
    </form>
  );
}
