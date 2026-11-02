"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel, Switch, TextField } from "@rallix/ui";
import { saveCompetitionDetails } from "../../../../../lib/competition-actions";

type Init = { summary: string; prize: string; rules: string; openRegistration: boolean; maxPlayers: string; closesOn: string };

export function DetailsForm({ id, draft, initial }: { id: string; draft: boolean; initial: Init }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const set = <K extends keyof Init>(k: K, val: Init[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(undefined);
    const r = await saveCompetitionDetails(id, { summary: v.summary, prize: v.prize, rules: v.rules, openRegistration: v.openRegistration, maxPlayers: v.maxPlayers ? Number(v.maxPlayers) : null, closesOn: v.closesOn || null });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Saved." }); router.refresh();
  }
  return (
    <form noValidate onSubmit={save}>
      <Panel title="What players see">
        <TextField label={`One-line summary (${v.summary.length}/140)`} placeholder="E.g. Our season opener. Everyone welcome." maxLength={140} value={v.summary} onChange={(e) => set("summary", e.target.value)} />
        <TextField label="Prize (optional)" placeholder="E.g. Trophy and ₦50,000" maxLength={100} value={v.prize} onChange={(e) => set("prize", e.target.value)} />
        <label className="rx-field"><span className="rx-label">Rules (optional)</span>
          <textarea className="rx-input" rows={8} maxLength={8000} placeholder="Best of five games. Matches start on time. Be kind to the umpire." value={v.rules} onChange={(e) => set("rules", e.target.value)} style={{ minHeight: 160, padding: 12, resize: "vertical" }} />
        </label>
      </Panel>
      {draft ? (
        <Panel title="Sign-up">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div><strong style={{ display: "block", fontWeight: 600 }}>Players can join themselves</strong><span className="rx-muted" style={{ fontSize: 13 }}>Switch off to close sign-up.</span></div>
            <Switch label="Players can join themselves" checked={v.openRegistration} onChange={(on) => set("openRegistration", on)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <TextField label="Spot limit (optional)" inputMode="numeric" placeholder="E.g. 16" value={v.maxPlayers} onChange={(e) => set("maxPlayers", e.target.value.replace(/\D/g, ""))} />
            <TextField label="Sign-up closes (optional)" type="date" value={v.closesOn} onChange={(e) => set("closesOn", e.target.value)} />
          </div>
        </Panel>
      ) : null}
      {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "rx-muted" : "rx-error"}>{msg.text}</p> : null}
      <Button type="submit" block disabled={busy}>{busy ? "Saving…" : "Save details"}</Button>
    </form>
  );
}
