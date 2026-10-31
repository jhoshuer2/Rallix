"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Icon, Segmented, Switch, TextField } from "@rallix/ui";
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

  return (
    <>
      <div className="rx-pagehead__row" style={{ alignItems: "center", marginBottom: 16 }}>
        <h1 className="rx-title">Manage your subscription</h1>
        <Button onClick={() => { setAdding(!adding); setName(""); setPrice(""); }}>+ New</Button>
      </div>
      <Segmented label="Billing period" value={period} onChange={setPeriod} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />
      <div style={{ height: 16 }} />
      {adding ? (
        <Card variant="outline" className="rx-plan">
          <TextField label="Plan name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label={`Price per ${period === "monthly" ? "month" : "year"} (₦)`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
          <Button disabled={pending} onClick={() => run(() => savePlan({ name, naira: Number(price), period }), () => { setAdding(false); return "Plan added."; })}>Save plan</Button>
        </Card>
      ) : null}
      {plans.filter((p) => p.period === period).map((p) => (
        <Card key={p.id} variant="outline" className="rx-plan">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{p.name}</span>
            <Switch label={`${p.name} plan enabled`} checked={p.active} onChange={(v) => run(() => setPlanActive(p.id, v))} />
          </div>
          <p className="rx-title" style={{ fontSize: 32, margin: "8px 0 16px" }}>{naira(p.priceKobo)}</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {p.perks.map((perk) => <li key={perk} style={{ display: "flex", gap: 8, alignItems: "center" }}><Icon name="check" size={18} />{perk}</li>)}
          </ul>
          {editing === p.id ? (
            <div style={{ marginTop: 16 }}>
              <TextField label="New price (₦)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
              <Button disabled={pending} onClick={() => run(() => savePlan({ id: p.id, name: p.name, naira: Number(price), period: p.period }), () => { setEditing(null); return "Price updated."; })}>Save price</Button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <Button variant="ghost" onClick={() => { setEditing(p.id); setPrice(String(p.priceKobo / 100)); }}><Icon name="edit" size={16} /> Edit price</Button>
              <Button variant="ghost" disabled={pending || !p.active} onClick={() => run(() => billMembers(p.id), (r) => `Billed ${r.created as number} member${r.created === 1 ? "" : "s"} for this month.`)}><Icon name="wallet" size={16} /> Bill all members</Button>
            </div>
          )}
        </Card>
      ))}
      {plans.filter((p) => p.period === period).length === 0 && !adding ? <p className="rx-muted">No {period} plans yet. Tap + New to add one.</p> : null}
      <p role="status" aria-live="polite" className="rx-muted">{msg}</p>
    </>
  );
}
