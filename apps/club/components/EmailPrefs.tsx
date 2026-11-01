"use client";
import { useState } from "react";
import { Switch } from "@rallix/ui";
import { setEmailOptOut } from "../lib/preference-actions";

/** Optional emails only. Sign-in codes and receipts always arrive. */
export function EmailPrefs({ optedOut }: { optedOut: boolean }) {
  const [off, setOff] = useState(optedOut);
  const [error, setError] = useState<string>();
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span id="optional-emails">Email me dues reminders and club announcements</span>
        <Switch label="Email me dues reminders and club announcements" checked={!off} onChange={async (on) => { const prev = off; setOff(!on); setError(undefined); const r = await setEmailOptOut(!on); if (!r.ok) { setOff(prev); setError(r.error); } }} />
      </div>
      <p className="rx-muted" style={{ fontSize: 13, margin: "8px 0 0" }}>{off ? "You won’t get reminders, so remember to check your dues in the app." : "You’ll get a friendly reminder before and after a due date. Sign-in codes always arrive."}</p>
      {error ? <p role="alert" className="rx-error">{error}</p> : null}
    </div>
  );
}
