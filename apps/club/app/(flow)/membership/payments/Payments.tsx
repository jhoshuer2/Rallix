"use client";
import { useState } from "react";
import { useState as useS, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, PaymentRow, Segmented, type PayStatus } from "@rallix/ui";
import { recordManualPayment } from "../../../../lib/payment-actions";

const filters = ["all", "paid", "pending", "failed", "refunded"] as const;
type F = (typeof filters)[number];
type Row = { rank: number; name: string; photo?: string; detail: string; amount: string; status: PayStatus; dueId: string; unpaid: boolean };

function RecordButtons({ dueId, name }: { dueId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useS<string>();
  const go = (method: "cash" | "transfer") => start(async () => { const r = await recordManualPayment({ dueId, method }); if (r.ok) router.refresh(); else setErr(r.error); });
  return (
    <li style={{ listStyle: "none", display: "flex", gap: 8, flexWrap: "wrap", margin: "-2px 0 10px", paddingLeft: 8 }}>
      <Button variant="ghost" disabled={pending} onClick={() => go("cash")} aria-label={`Record cash payment from ${name}`}>Paid cash</Button>
      <Button variant="ghost" disabled={pending} onClick={() => go("transfer")} aria-label={`Record transfer payment from ${name}`}>Paid by transfer</Button>
      {err ? <span role="alert" className="rx-error">{err}</span> : null}
    </li>
  );
}

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
        <ul className="rx-pays">{shown.flatMap((p) => { const { dueId, unpaid, ...row } = p; return [<PaymentRow key={`${p.rank}-${p.name}`} {...row} />, ...(unpaid ? [<RecordButtons key={`r-${dueId}`} dueId={dueId} name={p.name} />] : [])]; })}</ul>
      )}
    </>
  );
}
