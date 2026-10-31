"use client";
import { useState } from "react";
import { PaymentRow, Segmented } from "@rallix/ui";
import { payments } from "../../../../lib/mock";

const filters = ["all", "paid", "pending", "failed", "refunded"] as const;
type F = (typeof filters)[number];

export function Payments() {
  const [f, setF] = useState<F>("all");
  const rows = payments.filter((p) => f === "all" || p.status === f);
  return (
    <>
      <div className="rx-pagehead__row" style={{ alignItems: "center", marginBottom: 16 }}>
        <h1 className="rx-title">Manage your members</h1>
      </div>
      <Segmented scroll label="Payment status" value={f} onChange={setF} options={filters.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} />
      <div style={{ height: 16 }} />
      {rows.length === 0 ? <p className="rx-muted">No {f} payments yet.</p> : (
        <ul className="rx-pays">{rows.map((p) => <PaymentRow key={p.rank} {...p} />)}</ul>
      )}
    </>
  );
}
