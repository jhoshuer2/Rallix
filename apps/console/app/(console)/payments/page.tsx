import { Badge, Empty, Kpi, PageHead } from "../../../components/ui";
import { dateTime, naira } from "../../../lib/format";
import Link from "next/link";
import { ATTENTION, paidButSuspended, paymentEvents, paymentsSummary, reminderStats } from "../../../lib/queries";
import { RunButton } from "../../../components/Forms";
import { runRemindersJob } from "../../../lib/actions";
import { ago } from "../../../lib/format";

const tone = (o: string) => (o === "credited" ? "ok" : ATTENTION.includes(o) ? "bad" : undefined) as "ok" | "bad" | undefined;
const hint: Record<string, string> = {
  rejected_signature: "Someone sent a webhook that was not signed by the payment provider. It was ignored.",
  rejected_mismatch: "The provider reports a different amount or currency than we recorded. Not credited. Check it by hand.",
  duplicate_payment: "Money was taken for something already paid. The payment is recorded; the extra amount may need refunding.",
  unknown_reference: "A payment arrived for a reference we never created.",
  error: "Processing failed. The provider will retry; if it keeps failing, investigate.",
};

export default async function Payments() {
  const [events, s, stuck, rem] = await Promise.all([paymentEvents(), paymentsSummary(), paidButSuspended(), reminderStats()]);
  const attention = events.filter((e) => ATTENTION.includes(e.outcome) && e.event !== "return.verify");
  return (
    <>
      <PageHead title="Payments" sub="Online payments through Paystack, and anything that needs a human to look at it." />
      <div className="cs-kpis">
        <Kpi label="Player dues paid online (30 days)" value={naira(s!.dues_online_30d)} note={`${s!.dues_online_count} payments · settled straight to clubs`} />
        <Kpi label="Rallix invoices paid online (30 days)" value={naira(s!.invoices_online_30d)} />
        <Kpi label="Clubs accepting online dues" value={`${s!.clubs_with_payouts} of ${s!.clubs_total}`} note="Active clubs with a payout account" />
        <Kpi label="Stuck payments" value={s!.pending_old} note="Started over a day ago, never completed" />
      </div>
      <h2 className="cs-h2">Dues reminders</h2>
      <div className="cs-kpis">
        <Kpi label="Reminders sent (7 days)" value={rem!.sent_7d} note={rem!.failed_7d ? `${rem!.failed_7d} failed` : "None failed"} />
        <Kpi label="Clubs with reminders on" value={`${rem!.clubs_on} of ${rem!.clubs_total}`} note="Clubs choose this themselves" />
        <Kpi label="People who opted out" value={rem!.opted_out} />
        <Kpi label="Last job run that sent mail" value={rem!.last_run ? ago(rem!.last_run) : "never"} note="Set up the daily call; see packages/payments/README" />
      </div>
      <p style={{ margin: "12px 0 0" }}><RunButton action={runRemindersJob as () => Promise<{ ok: boolean }>} success="Reminder job ran. See the numbers above after a refresh.">Run the reminder job now</RunButton></p>
      {stuck.length ? (
        <>
          <h2 className="cs-h2">Paid but still locked out</h2>
          <div className="cs-tablewrap"><table className="cs-table"><tbody>
            {stuck.map((c) => (
              <tr key={c.club_id}><td><Link className="cs-rowlink" href={`/clubs/${c.club_id}`}>{c.club_name}</Link></td><td><Badge tone="bad">{c.status}</Badge></td>
                <td>Paid {c.number}. {c.reason === "non_payment" ? "Other invoices are still overdue, so it has not come back automatically." : "It was suspended for another reason, so only staff can reactivate it."}</td></tr>
            ))}
          </tbody></table></div>
        </>
      ) : null}
      <h2 className="cs-h2">Needs attention (last 7 days)</h2>
      {attention.length === 0 ? <Empty>Nothing needs attention.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table"><tbody>
          {attention.slice(0, 20).map((e) => (
            <tr key={e.id}><td style={{ whiteSpace: "nowrap" }}>{dateTime(e.received_at)}</td><td><Badge tone="bad">{e.outcome.replace(/_/g, " ")}</Badge></td>
              <td>{hint[e.outcome]}<br /><span className="cs-hint">{e.reference ?? "no reference"}{e.detail ? ` · ${e.detail}` : ""}</span></td></tr>
          ))}
        </tbody></table></div>
      )}
      <h2 className="cs-h2">All payment events</h2>
      {events.length === 0 ? <Empty>No payment events yet.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table">
          <thead><tr><th>When</th><th>Event</th><th>Outcome</th><th>Signature</th><th>Reference</th></tr></thead>
          <tbody>{events.map((e) => (
            <tr key={e.id}><td style={{ whiteSpace: "nowrap" }}>{dateTime(e.received_at)}</td><td>{e.event}</td><td><Badge tone={tone(e.outcome)}>{e.outcome.replace(/_/g, " ")}</Badge></td>
              <td>{e.signature_valid ? "valid" : <Badge tone="bad">invalid</Badge>}</td><td><code style={{ fontSize: 12 }}>{e.reference ?? "—"}</code></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
