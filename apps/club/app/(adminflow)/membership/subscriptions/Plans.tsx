"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon, Panel, Segmented, Switch, TextField } from "@rallix/ui";
import { billMembers, savePlan, setPlanActive } from "../../../../lib/actions";

type Plan = { id: string; name: string; priceKobo: number; period: "monthly" | "yearly"; perks: string[]; active: boolean };
const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;

export function Plans({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>, ok?: (r: Record<string, unknown>) => string) =>
    start(async () => { const r = await fn(); setMsg(r.ok ? ok?.(r) : r.error); if (r.ok) router.refresh(); });
  const shown = plans.filter((p) => p.period === period);

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ flex: 1 }}><Segmented label="Billing period" value={period} onChange={setPeriod} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} /></div>
        <Button onClick={() => { setAdding(!adding); setName(""); setPrice(""); }}>+ New</Button>
      </div>
      {adding ? (
        <Panel title="New plan">
          <TextField label="Plan name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label={`Price per ${period === "monthly" ? "month" : "year"} (₦)`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
          <Button block disabled={pending} onClick={() => run(() => savePlan({ name, naira: Number(price), period }), () => { setAdding(false); return "Plan added."; })}>Save plan</Button>
        </Panel>
      ) : null}
      {shown.map((p) => (
        <Panel key={p.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{p.name}</strong>
            <Switch label={`${p.name} plan enabled`} checked={p.active} onChange={(v) => run(() => setPlanActive(p.id, v))} />
          </div>
          <p className="rx-price">{naira(p.priceKobo)} <small>per {p.period === "monthly" ? "month" : "year"}</small></p>
          {p.perks.length ? <ul className="rx-perks">{p.perks.map((perk) => <li key={perk}><Icon name="check" size={18} />{perk}</li>)}</ul> : null}
          {editing === p.id ? (
            <>
              <TextField label="New price (₦)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
              <Button block disabled={pending} onClick={() => run(() => savePlan({ id: p.id, name: p.name, naira: Number(price), period: p.period }), () => { setEditing(null); return "Price updated."; })}>Save price</Button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="ghost" onClick={() => { setEditing(p.id); setPrice(String(p.priceKobo / 100)); }}><Icon name="edit" size={16} /> Edit price</Button>
              <Button variant="ghost" disabled={pending || !p.active} onClick={() => run(() => billMembers(p.id), (r) => `Billed ${r.created as number} member${r.created === 1 ? "" : "s"} for this month.`)}><Icon name="wallet" size={16} /> Bill all members</Button>
            </div>
          )}
        </Panel>
      ))}
      {shown.length === 0 && !adding ? <p className="rx-muted" style={{ marginTop: 16 }}>No {period} plans yet. Tap + New to add one.</p> : null}
      <p role="status" aria-live="polite" className="rx-muted">{msg}</p>
    </>
  );
}
