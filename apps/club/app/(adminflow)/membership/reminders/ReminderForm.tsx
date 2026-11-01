"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Panel, Switch } from "@rallix/ui";
import { OFFSET_CHOICES, describeOffset } from "@rallix/payments/reminders"; // browser-safe entry: the main entry imports Node crypto
import { runRemindersNow, saveReminderSettings, sendTestReminder } from "../../../../lib/reminder-actions";

export function ReminderForm({ enabled: e0, offsets: o0, unpaid, optedOut }: { enabled: boolean; offsets: number[]; unpaid: number; optedOut: number }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(e0);
  const [offsets, setOffsets] = useState<number[]>(o0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = enabled !== e0 || [...offsets].sort((a, b) => a - b).join() !== [...o0].sort((a, b) => a - b).join();
  const toggle = (v: number) => setOffsets(offsets.includes(v) ? offsets.filter((x) => x !== v) : [...offsets, v]);
  const say = (ok: boolean, text: string) => setMsg({ ok, text });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <strong>Send reminders automatically</strong>
          <Switch label="Send dues reminders automatically" checked={enabled} onChange={setEnabled} />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>{enabled ? "On. Reminders are sent once a day, on the days you choose below." : "Off. Nobody gets reminder emails until you turn this on."}</p>
      </Panel>

      <Panel><fieldset style={{ border: 0, margin: 0, padding: 0 }} disabled={!enabled}>
        <legend style={{ fontWeight: 700, padding: 0, marginBottom: 8 }}>When should we remind them?</legend>
        <p style={{ margin: "0 0 8px", fontSize: 14 }}>Pick up to six days, counted from each member’s due date.</p>
        {OFFSET_CHOICES.map((v) => (
          <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={offsets.includes(v)} onChange={() => toggle(v)} style={{ width: 22, height: 22, accentColor: "var(--rx-blue)" }} />
            {describeOffset(v)}
          </label>
        ))}
        {offsets.length === 0 ? <p role="alert" className="rx-error">Choose at least one day.</p> : null}
      </fieldset></Panel>

      <p className="rx-muted" style={{ margin: 0, fontSize: 14 }}>{unpaid} member{unpaid === 1 ? "" : "s"} currently {unpaid === 1 ? "has" : "have"} unpaid dues{optedOut ? `; ${optedOut} turned reminders off and won’t be emailed` : ""}.</p>

      <Button block disabled={pending || !dirty || offsets.length === 0} onClick={() => start(async () => { const r = await saveReminderSettings({ enabled, offsets }); say(r.ok, r.ok ? "Saved." : r.error); if (r.ok) router.refresh(); })}>{pending ? "Working…" : dirty ? "Save changes" : "Saved"}</Button>
      <Button variant="ghost" block disabled={pending} onClick={() => start(async () => { const r = await sendTestReminder(); say(r.ok, r.ok ? "Test sent to your email. It looks exactly like what members get." : r.error); })}>Email me a test reminder</Button>
      <Button variant="ghost" block disabled={pending || !e0 || dirty} onClick={() => start(async () => { const r = await runRemindersNow(); say(r.ok, r.ok ? `Done: ${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}${r.waiting ? `, ${r.waiting} more waiting` : ""}.` : r.error); if (r.ok) router.refresh(); })}>Send today’s reminders now</Button>
      {!e0 ? <p className="rx-muted" style={{ margin: 0, fontSize: 13 }}>Save with reminders turned on to enable “send now”.</p> : null}
      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "rx-muted" : "rx-error"} >{msg.text}</p> : null}
    </div>
  );
}
