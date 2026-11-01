import Link from "next/link";
import { BackButton, Chip, PageHead } from "@rallix/ui";
import { requireRole } from "../../../../lib/context";
import { rallixBilling } from "../../../../lib/payment-queries";
import { naira } from "../../../../lib/queries";
import { PayInvoiceButton } from "./PayInvoiceButton";

export default async function RallixBilling() {
  const ctx = await requireRole("admin");
  const { subscription: s, invoices } = await rallixBilling(ctx);
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—");
  return (
    <>
      <PageHead back={<BackButton href="/membership" linkAs={Link} />} title="Rallix subscription" />
      <div className="rx-card" style={{ marginBottom: 24 }}>
        {s ? (
          <>
            <Chip tone={s.status === "active" ? "active" : s.status === "past_due" ? "dark" : undefined}>{s.status.replace("_", " ")}</Chip>
            <p className="rx-title" style={{ fontSize: 28, margin: "12px 0 4px" }}>{naira(s.amountKobo)} <span style={{ fontSize: 14 }}>/ {s.period === "monthly" ? "month" : "year"}</span></p>
            <p style={{ margin: 0 }}>Renews {fmt(s.currentPeriodEnd)}</p>
          </>
        ) : <p style={{ margin: 0 }}>No subscription yet. Rallix will contact you to set one up.</p>}
      </div>
      <h2 className="rx-section__title" style={{ marginBottom: 12 }}>Invoices</h2>
      {invoices.length === 0 ? <p className="rx-muted">No invoices yet.</p> : invoices.map((i) => (
        <div key={i.id} className="rx-card" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <strong>{i.number}</strong><Chip tone={i.status === "paid" ? "active" : i.status === "issued" ? "warn" : undefined}>{i.status}</Chip>
          </div>
          <p style={{ margin: "8px 0 0" }}>{i.description ?? `Period ${i.periodLabel}`}</p>
          <p style={{ margin: "4px 0 12px" }}>{naira(i.amountKobo)}{i.status === "issued" && i.dueAt ? ` · due ${fmt(i.dueAt)}` : i.status === "paid" ? ` · paid ${fmt(i.paidAt)}` : ""}</p>
          {i.status === "issued" ? <PayInvoiceButton invoiceId={i.id} amount={naira(i.amountKobo)} /> : null}
        </div>
      ))}
    </>
  );
}
