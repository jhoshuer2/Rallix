"use client";
import { useState } from "react";
import { Button } from "@rallix/ui";
import { setOptOutByToken } from "../../../../lib/preference-actions";

export function UnsubscribeButtons({ token, initiallyOut }: { token: string; initiallyOut: boolean }) {
  const [out, setOut] = useState(initiallyOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function change(next: boolean) { setBusy(true); setError(undefined); const r = await setOptOutByToken(token, next); setBusy(false); if (r.ok) setOut(next); else setError(r.error); }
  return (
    <div role="status" aria-live="polite">
      <p style={{ margin: "0 0 16px", fontSize: 18 }}>{out ? "You are unsubscribed. We won’t send you reminders or announcements." : "You currently receive dues reminders and club announcements."}</p>
      <Button block variant={out ? "ghost" : undefined} disabled={busy} onClick={() => change(!out)}>{busy ? "Saving…" : out ? "Turn emails back on" : "Unsubscribe"}</Button>
      {error ? <p role="alert" className="rx-error" style={{ marginTop: 12 }}>{error}</p> : null}
    </div>
  );
}
