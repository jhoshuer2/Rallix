import Link from "next/link";
import { BackButton, EmptyState, IconBadge, ListActions, ListGroup, ListRow, MetricCard, MetricGrid, PageShell, Pill } from "@rallix/ui";
import { requireRole } from "../../../../lib/context";
import { rallixBilling } from "../../../../lib/payment-queries";
import { naira } from "../../../../lib/queries";
import { PayInvoiceButton } from "./PayInvoiceButton";

export default async function RallixBilling() {
  const ctx = await requireRole("admin");
  const { subscription: s, invoices } = await rallixBilling(ctx);
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—");
  return (
    <PageShell back={<BackButton href="/membership" linkAs={Link} />} title="Rallix subscription">
      {s ? (
        <MetricGrid>
          <MetricCard label="Your plan" value={naira(s.amountKobo)} hint={`per ${s.period === "monthly" ? "month" : "year"}`} />
          <MetricCard label={s.status === "active" ? "Renews" : "Status"} value={s.status === "active" ? fmt(s.currentPeriodEnd).replace(/ \d{4}$/, "") : s.status.replace("_", " ")} tone={s.status === "active" ? "good" : "bad"} hint={s.status === "active" ? "Active" : `Period ends ${fmt(s.currentPeriodEnd)}`} />
        </MetricGrid>
      ) : <EmptyState compact title="No subscription yet" hint="Rallix will contact you to set one up." />}
      {invoices.length > 0 ? (
        <>
          <h2 className="rx-panel__title" style={{ margin: "32px 0 0" }}>Invoices</h2>
          <ListGroup label="Invoices">
            {invoices.flatMap((i) => [
              <ListRow key={i.id} media={<IconBadge icon="money" />} title={i.number} subtitle={`${i.description ?? `Period ${i.periodLabel}`}${i.status === "issued" && i.dueAt ? ` · due ${fmt(i.dueAt)}` : i.status === "paid" ? ` · paid ${fmt(i.paidAt)}` : ""}`}
                trailing={<>{naira(i.amountKobo)} <Pill tone={i.status === "paid" ? "success" : i.status === "issued" ? "warning" : "neutral"}>{i.status}</Pill></>} />,
              ...(i.status === "issued" ? [<ListActions key={`p-${i.id}`}><PayInvoiceButton invoiceId={i.id} amount={naira(i.amountKobo)} /></ListActions>] : []),
            ])}
          </ListGroup>
        </>
      ) : <EmptyState compact title="No invoices yet" hint="Invoices from Rallix will show up here." />}
    </PageShell>
  );
}
