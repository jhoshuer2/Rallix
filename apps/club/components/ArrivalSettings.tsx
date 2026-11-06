"use client";
import { useEffect, useState } from "react";
import { Switch, useToast } from "@rallix/ui";
import { saveArrivalSettings, savePushSubscription } from "../lib/arrival-actions";
import { enablePush, isIOS, isStandalone } from "../lib/client-geo";

type S = { share: boolean; notify: boolean; auto: boolean };

/** Your three arrival switches. Everything is off until you turn it on, per club. */
export function ArrivalSettings({ initial, vapidKey }: { initial: S; vapidKey: string | null }) {
  const [s, setS] = useState(initial);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState(false);
  useEffect(() => { setInstall(isIOS() && !isStandalone()); }, []);

  async function update(next: S, before: S) {
    setS(next);
    const r = await saveArrivalSettings(next);
    if (!r.ok) { setS(before); toast.error(r.error); } else toast.success("Saved.");
  }
  async function toggleNotify(on: boolean) {
    if (busy) return;
    if (!on) return update({ ...s, notify: false }, s);
    setBusy(true);
    const err = await enablePush(vapidKey, savePushSubscription);
    setBusy(false);
    if (err) return toast.error(err);
    await update({ ...s, notify: true }, s);
  }
  const row = (label: string, hint: string, checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, opacity: disabled ? .5 : 1 }}>
      <div><strong style={{ display: "block", fontWeight: 600 }}>{label}</strong><span className="rx-muted" style={{ fontSize: 13 }}>{hint}</span></div>
      {disabled ? <Switch label={label} checked={false} onChange={() => {}} /> : <Switch label={label} checked={checked} onChange={onChange} />}
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {row("Share when I arrive", "Players in this club can see when you check in at the court.", s.share, (v) => update({ share: v, notify: s.notify, auto: v ? s.auto : false }, s))}
      {row("Alert me when players arrive", "A lock-screen alert with their name. Needs notifications allowed.", s.notify, toggleNotify)}
      {row("Check in automatically", "When Rallix is open and you are at the court. Needs location allowed.", s.auto, (v) => update({ ...s, auto: v }, s), !s.share)}
      {install ? <p className="rx-muted" style={{ fontSize: 13, margin: 0 }}>On iPhone, alerts only work after you add Rallix to your Home Screen: tap Share, then Add to Home Screen, and open Rallix from there.</p> : null}
      <p className="rx-muted" style={{ fontSize: 13, margin: 0 }}>Rallix only knows you are at the court when you tap “I’ve arrived”, or when it is open and you have turned on automatic check-in. It does not track you in the background, and your position is never stored.</p>
    </div>
  );
}
