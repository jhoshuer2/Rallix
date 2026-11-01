"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ListActions, ListGroup, ListRow, Photo, Pill, Segmented } from "@rallix/ui";
import { recordManualPayment } from "../../../../lib/payment-actions";

const filters = ["all", "paid", "pending", "failed", "refunded"] as const;
type F = (typeof filters)[number];
type Status = "paid" | "pending" | "failed" | "refunded";
type Row = { rank: number; name: string; photo?: string; detail: string; amount: string; status: Status; dueId: string; unpaid: boolean };
const label: Record<F, string> = { all: "All", paid: "Paid", pending: "Due", failed: "Overdue", refunded: "Waived" };
const tone: Record<Status, "success" | "warning" | "neutral"> = { paid: "success", pending: "warning", failed: "warning", refunded: "neutral" };

function RecordButtons({ dueId, name }: { dueId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const go = (method: "cash" | "transfer") => start(async () => { const r = await recordManualPayment({ dueId, method }); if (r.ok) router.refresh(); else setErr(r.error); });
  return (
    <ListActions>
      <Button variant="ghost" disabled={pending} onClick={() => go("cash")} aria-label={`Record cash payment from ${name}`}>Paid cash</Button>
      <Button variant="ghost" disabled={pending} onClick={() => go("transfer")} aria-label={`Record transfer payment from ${name}`}>Paid by transfer</Button>
      {err ? <span role="alert" className="rx-error">{err}</span> : null}
    </ListActions>
  );
}

export function Payments({ rows }: { rows: Row[] }) {
  const [f, setF] = useState<F>("all");
  const shown = rows.filter((p) => f === "all" || p.status === f);
  return (
    <>
      <Segmented scroll label="Payment status" value={f} onChange={setF} options={filters.map((v) => ({ value: v, label: label[v] }))} />
      {shown.length === 0 ? <p className="rx-muted" style={{ marginTop: 16 }}>{rows.length === 0 ? "No dues yet. Open Plans and tap Bill all members." : `Nothing ${label[f].toLowerCase()}.`}</p> : (
        <ListGroup label="Member payments">
          {shown.flatMap((p) => [
            <ListRow key={p.dueId} media={<Photo src={p.photo} name={p.name} alt="" />} title={p.name} subtitle={p.detail} trailing={<>{p.amount} {p.status !== "paid" ? <Pill tone={tone[p.status]}>{label[p.status]}</Pill> : <Pill tone="success">Paid</Pill>}</>} />,
            ...(p.unpaid ? [<RecordButtons key={`r-${p.dueId}`} dueId={p.dueId} name={p.name} />] : []),
          ])}
        </ListGroup>
      )}
    </>
  );
}
