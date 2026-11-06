"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel, TextField, useToast } from "@rallix/ui";
import { sendHelpRequest } from "../lib/help-actions";

/** One short form. The answer comes by email, so we say so. */
export function HelpForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Panel>
      <form noValidate onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        const r = await sendHelpRequest({ title, body });
        setBusy(false);
        if (!r.ok) return toast.error(r.error);
        setTitle(""); setBody(""); toast.success("Sent. We’ll reply by email."); router.refresh();
      }} style={{ display: "grid", gap: 12 }}>
        <TextField label="What do you need help with?" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scores won’t save" />
        <label className="rx-field"><span className="rx-label">Details (optional)</span>
          <textarea className="rx-input" rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 120, paddingTop: 12 }} />
        </label>
        <Button type="submit" block disabled={busy || title.trim().length < 3}>{busy ? "Sending…" : "Send to Rallix support"}</Button>
      </form>
    </Panel>
  );
}
