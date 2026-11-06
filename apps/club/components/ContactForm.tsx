"use client";
import { useState } from "react";
import { Button, TextField, useToast } from "@rallix/ui";
import { updateContact } from "../lib/actions";

/** Email is the sign-in identity and can't be edited here. Phone is optional and only used to contact you. */
export function ContactForm({ email, phone }: { email: string; phone: string }) {
  const [value, setValue] = useState(phone);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await updateContact({ phone: value }); setBusy(false); if (r.ok) toast.success("Phone number saved."); else toast.error(r.error); }}>
      <p className="rx-label" style={{ marginBottom: 4 }}>Sign-in email</p>
      <p style={{ margin: "0 0 16px", wordBreak: "break-all" }}>{email}</p>
      <TextField label="Phone or WhatsApp (optional)" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={value} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" variant="ghost" block disabled={busy}>{busy ? "Saving…" : "Save contact details"}</Button>
    </form>
  );
}
