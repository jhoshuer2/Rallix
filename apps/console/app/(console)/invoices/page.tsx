import Link from "next/link";
import { Badge, Empty, PageHead } from "../../../components/ui";
import { NewInvoiceForm } from "../../../components/Forms";
import { date, naira } from "../../../lib/format";
import { clubOptions, listInvoices } from "../../../lib/queries";

const tabs = [["", "All"], ["draft", "Draft"], ["issued", "Issued"], ["paid", "Paid"], ["void", "Void"]] as const;

export default async function Invoices({ searchParams }: { searchParams: Promise<{ status?: string; new?: string }> }) {
  const sp = await searchParams;
  const [rows, clubs] = await Promise.all([listInvoices(sp.status), clubOptions()]);
  return (
    <>
      <PageHead title="Invoices" sub="Invoices Rallix has issued to clubs." actions={<Link className="cs-btn" href="/invoices?new=1">New invoice</Link>} />
      {sp.new ? <section className="cs-card" style={{ marginBottom: 20 }}><h2 className="cs-h2" style={{ marginTop: 0 }}>New invoice</h2><NewInvoiceForm clubs={clubs} /></section> : null}
      <nav className="cs-tabs" aria-label="Invoice status">
        {tabs.map(([k, label]) => <Link key={k} href={k ? `/invoices?status=${k}` : "/invoices"} aria-current={(sp.status ?? "") === k ? "page" : undefined}>{label}</Link>)}
      </nav>
      {rows.length === 0 ? <Empty>No invoices here.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table">
          <thead><tr><th>Number</th><th>Club</th><th>Period</th><th>Status</th><th className="num">Amount</th><th>Due</th><th>Paid</th></tr></thead>
          <tbody>{rows.map((i) => (
            <tr key={i.id}>
              <td><Link className="cs-rowlink" href={`/invoices/${i.id}`}>{i.number}</Link></td>
              <td><Link href={`/clubs/${i.club_id}`}>{i.club_name}</Link></td><td>{i.period_label}</td>
              <td><Badge tone={i.status === "paid" ? "ok" : i.status === "issued" ? (i.due_at && new Date(i.due_at) < new Date() ? "bad" : "warn") : undefined}>{i.status === "issued" && i.due_at && new Date(i.due_at) < new Date() ? "overdue" : i.status}</Badge></td>
              <td className="num">{naira(i.amount_kobo)}</td><td>{date(i.due_at)}</td><td>{date(i.paid_at)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
