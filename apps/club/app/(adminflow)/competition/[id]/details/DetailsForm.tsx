"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel, SelectSheet, Switch, TextField, useToast } from "@rallix/ui";
import { saveCompetitionDetails } from "../../../../../lib/competition-actions";

type Init = { summary: string; prize: string; rules: string; openRegistration: boolean; maxPlayers: string; closesOn: string; pointsWin: string; pointsLoss: string; seasonId: string };

export function DetailsForm({ id, draft, initial, seasons, league }: { id: string; draft: boolean; initial: Init; seasons: Array<{ value: string; label: string }>; /** Points only matter where a table is shown (not for a knockout). */ league: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = <K extends keyof Init>(k: K, val: Init[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await saveCompetitionDetails(id, { summary: v.summary, prize: v.prize, rules: v.rules, openRegistration: v.openRegistration, maxPlayers: v.maxPlayers ? Number(v.maxPlayers) : null, closesOn: v.closesOn || null, pointsWin: Number(v.pointsWin), pointsLoss: Number(v.pointsLoss), seasonId: v.seasonId || null });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Saved."); router.refresh();
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
          <div className="rx-fieldpair rx-fieldpair--single" style={{ marginTop: 16 }}>
            <TextField label="Spot limit (optional)" inputMode="numeric" placeholder="E.g. 16" value={v.maxPlayers} onChange={(e) => set("maxPlayers", e.target.value.replace(/\D/g, ""))} />
            <TextField label="Sign-up closes (optional)" type="date" value={v.closesOn} onChange={(e) => set("closesOn", e.target.value)} />
          </div>
        </Panel>
      ) : null}
      {league || seasons.length ? (
        <Panel title="Points and season">
          {league ? (
            <div className="rx-fieldpair">
              <TextField label="Points for a win" type="number" inputMode="numeric" min={0} max={10} value={v.pointsWin} onChange={(e) => set("pointsWin", e.target.value)} />
              <TextField label="Points for a loss" type="number" inputMode="numeric" min={0} max={10} value={v.pointsLoss} onChange={(e) => set("pointsLoss", e.target.value)} />
            </div>
          ) : null}
          {seasons.length ? <SelectSheet label="Season (optional)" title="Season" value={v.seasonId} onChange={(x) => set("seasonId", x)} options={[{ value: "", label: "No season" }, ...seasons]} /> : null}
        </Panel>
      ) : null}
      <Button type="submit" block disabled={busy}>{busy ? "Saving…" : "Save details"}</Button>
    </form>
  );
}
