"use client";
import { useState } from "react";
import { PaymentRow, Segmented, type PayStatus } from "@rallix/ui";

const filters = ["all", "paid", "pending", "failed", "refunded"] as const;
type F = (typeof filters)[number];
type Row = { rank: number; name: string; photo?: string; detail: string; amount: string; status: PayStatus };

export function Payments({ rows }: { rows: Row[] }) {
  const [f, setF] = useState<F>("all");
  const shown = rows.filter((p) => f === "all" || p.status === f);
  return (
    <>
      <div className="rx-pagehead__row" style={{ alignItems: "center", marginBottom: 16 }}>
        <h1 className="rx-title">Manage your members</h1>
      </div>
      <Segmented scroll label="Payment status" value={f} onChange={setF} options={filters.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} />
      <div style={{ height: 16 }} />
      {shown.length === 0 ? <p className="rx-muted">{rows.length === 0 ? "No dues yet. Open Manage your subscription and tap Bill all members." : `No ${f} payments.`}</p> : (
        <ul className="rx-pays">{shown.map((p) => <PaymentRow key={`${p.rank}-${p.name}`} {...p} />)}</ul>
      )}
    </>
  );
}
