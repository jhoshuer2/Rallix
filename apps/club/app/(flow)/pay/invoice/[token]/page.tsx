import type { Metadata } from "next";
import { EntryShell, Panel, Pill } from "@rallix/ui";
import { lookupPayLink } from "../../../../../lib/pay-link";
import { naira } from "../../../../../lib/queries";
import { PayLinkForm } from "./PayLinkForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay your Rallix invoice", robots: { index: false, follow: false, nocache: true } };

/** Public. Anyone holding the link can pay this one invoice, and sees nothing beyond the invoice itself. */
export default async function PayLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await lookupPayLink(token);
  const date = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");

  if (v.state === "invalid") {
    return <EntryShell title="Link not valid"><p style={{ marginTop: 0 }}>This payment link isn’t valid any more. It may have been replaced or turned off. Please contact Rallix for a new one.</p></EntryShell>;
  }
  return (
    <EntryShell title={v.state === "payable" ? "Pay your Rallix invoice" : v.state === "paid" ? "Invoice paid" : "Invoice cancelled"} hero={<p style={{ margin: "16px 0 0" }}><Pill>Rallix invoice {v.number}</Pill></p>}>
      <Panel>
        <p style={{ margin: 0, fontWeight: 600 }}>{v.clubName}</p>
        <p className="rx-muted" style={{ margin: "4px 0 12px" }}>{v.description ?? `Rallix subscription, ${v.periodLabel}`}</p>
        <p className="rx-price" style={{ margin: 0 }}>{naira(v.amountKobo ?? 0)}</p>
      </Panel>
      <div style={{ height: 16 }} />
      {v.state === "payable" ? <PayLinkForm token={token} amount={naira(v.amountKobo ?? 0)} /> : null}
      {v.state === "paid" ? <p role="status">This invoice was paid{v.paidAt ? ` on ${date(v.paidAt)}` : ""}. Nothing more to do. Thank you!</p> : null}
      {v.state === "void" ? <p role="status">This invoice was cancelled by Rallix, so there is nothing to pay. Contact Rallix if you think this is a mistake.</p> : null}
    </EntryShell>
  );
}
