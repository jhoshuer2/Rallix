import { requireAdmin } from "../../../lib/guard";
import Link from "next/link";
import { Badge, Empty, PageHead } from "../../../components/ui";
import { NewSubscriptionForm, RunButton } from "../../../components/Forms";
import { date, naira } from "../../../lib/format";
import { clubsWithoutSubscription, listSubscriptions } from "../../../lib/queries";
import { generateInvoices, setSubscriptionStatus } from "../../../lib/actions";

export default async function Billing() {
  await requireAdmin("billing");
  const [subs, without] = await Promise.all([listSubscriptions(), clubsWithoutSubscription()]);
  const mrr = subs.filter((s) => s.status === "active").reduce((a, s) => a + (s.period === "monthly" ? s.amount_kobo : s.amount_kobo / 12), 0);
  return (
    <>
      <PageHead title="Billing" sub={`Club subscriptions. Monthly recurring revenue: ${naira(mrr)}.`}
        actions={<RunButton action={generateInvoices as () => Promise<{ ok: boolean }>} success="Invoices generated for this period." confirmText="Create an issued invoice for every active subscription that doesn't have one for this period?">Generate this period’s invoices</RunButton>} />
      {subs.length === 0 ? <Empty>No subscriptions yet. Add one below.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table">
          <thead><tr><th>Club</th><th>Billing</th><th>Status</th><th className="num">Amount</th><th>Renews</th><th>Change status</th></tr></thead>
          <tbody>{subs.map((s) => (
            <tr key={s.id}>
              <td><Link className="cs-rowlink" href={`/clubs/${s.club_id}`}>{s.club_name}</Link>{s.club_status !== "active" ? <> <Badge tone="bad">{s.club_status}</Badge></> : null}</td>
              <td>{s.period}</td>
              <td><Badge tone={s.status === "active" ? "ok" : s.status === "past_due" ? "bad" : undefined}>{s.status.replace("_", " ")}</Badge></td>
              <td className="num">{naira(s.amount_kobo)}</td><td>{date(s.current_period_end)}</td>
              <td><div className="cs-actions">
                {s.status !== "active" ? <RunButton tone="ghost" action={setSubscriptionStatus.bind(null, s.id, "active")} success="Marked active.">Active</RunButton> : null}
                {s.status !== "past_due" ? <RunButton tone="ghost" action={setSubscriptionStatus.bind(null, s.id, "past_due")} success="Marked past due.">Past due</RunButton> : null}
                {s.status !== "cancelled" ? <RunButton tone="danger" confirmText={`Cancel ${s.club_name}'s subscription?`} action={setSubscriptionStatus.bind(null, s.id, "cancelled")} success="Cancelled.">Cancel</RunButton> : null}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <h2 className="cs-h2">Add a subscription</h2>
      <div className="cs-card"><NewSubscriptionForm clubs={without} /></div>
      <p className="cs-hint" style={{ marginTop: 12 }}>Paystack collection is not connected yet, so payments are recorded by hand when you mark an invoice as paid.</p>
    </>
  );
}
