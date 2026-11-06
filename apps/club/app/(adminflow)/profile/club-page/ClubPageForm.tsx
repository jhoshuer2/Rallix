"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel, Switch, useToast } from "@rallix/ui";
import { saveClubPage } from "../../../../lib/application-actions";

type V = { about: string; schedule: string; dressCode: string; equipment: string; rules: string; contact: string; joinMode: "review" | "open"; published: boolean };

function Area({ label, hint, value, max, rows = 4, onChange }: { label: string; hint: string; value: string; max: number; rows?: number; onChange: (v: string) => void }) {
  return (
    <label className="rx-field"><span className="rx-label">{label}</span>
      <textarea className="rx-input" rows={rows} maxLength={max} placeholder={hint} value={value} onChange={(e) => onChange(e.target.value)} style={{ minHeight: rows * 28, padding: 12, resize: "vertical", width: "100%" }} />
    </label>
  );
}

export function ClubPageForm({ slug, initial }: { slug: string; initial: V }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = <K extends keyof V>(k: K, val: V[K]) => setV((p) => ({ ...p, [k]: val }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await saveClubPage(v);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Saved."); router.refresh();
  }
  return (
    <form noValidate onSubmit={save}>
      <p className="rx-muted" style={{ margin: "0 0 16px" }}>People see this on your invite link before they join. Only fill in what applies to your club. Your fee plans are shown automatically.</p>
      <Panel title="About your club">
        <Area label="About" hint="Who you are and what the club is like." value={v.about} max={1000} onChange={(x) => set("about", x)} />
        <Area label="When we play" hint="E.g. Saturdays 4pm to 8pm, Wednesday evenings. Closed on public holidays." value={v.schedule} max={2000} onChange={(x) => set("schedule", x)} />
        <Area label="Dress code" hint="E.g. Sports shoes and sportswear. No jeans." value={v.dressCode} max={1000} rows={3} onChange={(x) => set("dressCode", x)} />
        <Area label="Equipment" hint="E.g. Bring your own bat, or ask about borrowing one. Balls are provided." value={v.equipment} max={1000} rows={3} onChange={(x) => set("equipment", x)} />
        <Area label="Rules and guidelines" hint="How members are expected to behave, house rules, fees due dates." value={v.rules} max={8000} rows={6} onChange={(x) => set("rules", x)} />
        <Area label="Contact" hint="A phone number or email people can use." value={v.contact} max={500} rows={2} onChange={(x) => set("contact", x)} />
      </Panel>
      <Panel title="Joining">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div><strong style={{ display: "block", fontWeight: 600 }}>Review applications</strong><span className="rx-muted" style={{ fontSize: 13 }}>{v.joinMode === "review" ? "People apply and an admin approves them." : "Anyone with your invite link joins straight away."}</span></div>
          <Switch label="Review applications" checked={v.joinMode === "review"} onChange={(on) => set("joinMode", on ? "review" : "open")} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 20 }}>
          <div><strong style={{ display: "block", fontWeight: 600 }}>Public club page</strong><span className="rx-muted" style={{ fontSize: 13 }}>{v.published ? <>Anyone can read it at <Link href={`/club/${slug}`} style={{ textDecoration: "underline" }}>/club/{slug}</Link>.</> : "Only people with your invite link can read it."}</span></div>
          <Switch label="Public club page" checked={v.published} onChange={(on) => set("published", on)} />
        </div>
      </Panel>
      <Button type="submit" block disabled={busy}>{busy ? "Saving…" : "Save club page"}</Button>
    </form>
  );
}
