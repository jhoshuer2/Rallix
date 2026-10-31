"use client";
import { useState } from "react";
import { Button, Card, Icon, Segmented, Switch } from "@rallix/ui";
import { plans as initial } from "../../../../lib/mock";

export function Plans() {
  const [period, setPeriod] = useState("monthly");
  const [plans, setPlans] = useState(initial);
  return (
    <>
      <div className="rx-pagehead__row" style={{ alignItems: "center", marginBottom: 16 }}>
        <h1 className="rx-title">Manage your subscription</h1>
        <Button ball={false}>+ New</Button>
      </div>
      <Segmented label="Billing period" value={period} onChange={setPeriod} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />
      <div style={{ height: 16 }} />
      {plans.filter((p) => p.period === period).map((p) => (
        <Card key={p.id} variant="outline" className="rx-plan">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{p.name}</span>
            <Switch label={`${p.name} plan enabled`} checked={p.on} onChange={(v) => setPlans(plans.map((x) => (x.id === p.id ? { ...x, on: v } : x)))} />
          </div>
          <p className="rx-title" style={{ fontSize: 32, margin: "8px 0 16px" }}>{p.price}</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {p.perks.map((perk) => <li key={perk} style={{ display: "flex", gap: 8, alignItems: "center" }}><Icon name="check" size={18} />{perk}</li>)}
          </ul>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Button variant="ghost"><Icon name="edit" size={16} /> Edit Price</Button>
            <Button variant="ghost"><Icon name="tag" size={16} /> Price</Button>
          </div>
        </Card>
      ))}
    </>
  );
}
