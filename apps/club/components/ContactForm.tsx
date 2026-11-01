"use client";
import { useState } from "react";
import { Button, TextField } from "@rallix/ui";
import { updateContact } from "../lib/actions";

/** Email is the sign-in identity and can't be edited here. Phone is optional and only used to contact you. */
export function ContactForm({ email, phone }: { email: string; phone: string }) {
  const [value, setValue] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMsg(null); const r = await updateContact({ phone: value }); setBusy(false); setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error }); }}>
      <p className="rx-label" style={{ marginBottom: 4 }}>Sign-in email</p>
      <p style={{ margin: "0 0 16px", wordBreak: "break-all" }}>{email}</p>
      <TextField label="Phone or WhatsApp (optional)" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={value} onChange={(e) => setValue(e.target.value)} />
      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "rx-muted" : "rx-error"} style={{ marginBottom: 12 }}>{msg.text}</p> : null}
      <Button type="submit" variant="ghost" block disabled={busy}>{busy ? "Saving…" : "Save contact details"}</Button>
    </form>
  );
}
