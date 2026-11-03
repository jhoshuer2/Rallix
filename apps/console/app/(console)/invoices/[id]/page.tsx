import { requireAdmin } from "../../../../lib/guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHead } from "../../../../components/ui";
import { InvoiceEmailCard, MarkPaidForm, PayLinkCard, PrintButton, RunButton } from "../../../../components/Forms";
import { setInvoiceStatus } from "../../../../lib/actions";
import { date, dateTime, naira, uuid } from "../../../../lib/format";
import { getInvoice, invoiceEmails } from "../../../../lib/queries";
import { payLinkUrl } from "../../../../lib/pay-link";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ emailed?: string; failed?: string }> }) {
  await requireAdmin("billing");
  const { id } = await params;
  const sp = await searchParams;
  if (!uuid.test(id)) notFound();
  const d = await getInvoice(id);
  if (!d) notFound();
  const { inv, settings: s } = d;
  const total = Number(inv.amount_kobo);
  const vat = s.vat_percent > 0 ? Math.round(total - total / (1 + s.vat_percent / 100)) : 0;
  const final = inv.status === "paid" || inv.status === "void";
  const tokenRow = inv.status === "issued" ? ((await db().execute(sql`select pay_token from platform_invoices where id = ${inv.id}`)).rows[0] as { pay_token: string | null } | undefined) : undefined;
  return (
    <>
      <div className="cs-noprint">
        <PageHead title={inv.number} sub={`${inv.club_name} · ${inv.period_label}`}
          actions={<>
            <Badge tone={inv.status === "paid" ? "ok" : inv.status === "issued" ? "warn" : undefined}>{inv.status}</Badge>
            <PrintButton />
            {inv.status === "draft" ? <RunButton action={setInvoiceStatus.bind(null, inv.id, "issued")} success="Invoice issued.">Issue invoice</RunButton> : null}
            {!final ? <RunButton tone="danger" confirmText={`Void invoice ${inv.number}? This cannot be undone.`} action={setInvoiceStatus.bind(null, inv.id, "void")} success="Invoice voided.">Void</RunButton> : null}
          </>} />
        {inv.status === "issued" ? <PayLinkCard invoiceId={inv.id} url={tokenRow?.pay_token ? payLinkUrl(tokenRow.pay_token) : null} club={inv.club_name} number={inv.number} amount={naira(total)} /> : null}
        {inv.status === "issued" ? <InvoiceEmailCard invoiceId={inv.id} flash={sp.emailed ? (sp.emailed === "err" ? "The invoice was created but the email could not be sent. Use the button below to try again." : `Invoice created and emailed to ${sp.emailed} admin${sp.emailed === "1" ? "" : "s"}${Number(sp.failed) ? `, ${sp.failed} failed` : ""}.`) : undefined} history={(await invoiceEmails(inv.id)).map((h) => ({ to: h.to_email, kind: h.kind, status: h.status, error: h.error, at: dateTime(h.created_at) }))} /> : null}
        {inv.status === "issued" ? <section className="cs-card" style={{ marginBottom: 20 }}><h2 className="cs-h2" style={{ marginTop: 0 }}>Record payment</h2><MarkPaidForm invoiceId={inv.id} /></section> : null}
        <p><Link href="/invoices">← All invoices</Link></p>
      </div>
      <article className="cs-invoice" aria-label={`Invoice ${inv.number}`}>
        <h1>Invoice</h1>
        <div className="cs-grid cs-grid--2">
          <div><strong>{s.company_name}</strong><br /><span className="cs-pre">{s.address}</span>{s.email ? <><br />{s.email}</> : null}{s.phone ? <><br />{s.phone}</> : null}</div>
          <div style={{ textAlign: "right" }}>
            <strong>{inv.number}</strong><br />Issued: {date(inv.issued_at ?? inv.created_at)}<br />Due: {date(inv.due_at)}
            {inv.status === "paid" ? <><br /><strong>PAID {date(inv.paid_at)}</strong>{inv.paid_online ? <><br />Paid online via Paystack</> : null}{inv.payment_ref ? <><br />Ref: {inv.payment_ref}</> : null}</> : null}
            {inv.status === "void" ? <><br /><strong>VOID</strong></> : null}
          </div>
        </div>
        <p style={{ marginTop: 28 }}><strong>Bill to</strong><br />{inv.club_name}{inv.club_location ? `, ${inv.club_location}` : ""}<br />Attn: {inv.owner_name}{inv.owner_phone ? ` · ${inv.owner_phone}` : ""}</p>
        <table>
          <thead><tr><th>Description</th><th>Period</th><th className="num">Amount</th></tr></thead>
          <tbody><tr><td>{inv.description ?? "Rallix subscription"}</td><td>{inv.period_label}</td><td className="num">{naira(total)}</td></tr></tbody>
          <tfoot>
            {vat > 0 ? <tr><td colSpan={2}>Includes VAT ({s.vat_percent}%)</td><td className="num">{naira(vat)}</td></tr> : null}
            <tr><td colSpan={2}><strong>Total due</strong></td><td className="num"><strong>{naira(total)}</strong></td></tr>
          </tfoot>
        </table>
        {s.payment_instructions ? <p><strong>How to pay</strong><br /><span className="cs-pre">{s.payment_instructions}</span></p> : null}
        <p className="cs-muted" style={{ marginTop: 32 }}>{s.footer_note}</p>
      </article>
    </>
  );
}
