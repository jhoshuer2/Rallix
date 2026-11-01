import { Badge, Empty, Kpi, PageHead } from "../../../components/ui";
import { dateTime, naira } from "../../../lib/format";
import { ATTENTION, paymentEvents, paymentsSummary } from "../../../lib/queries";

const tone = (o: string) => (o === "credited" ? "ok" : ATTENTION.includes(o) ? "bad" : undefined) as "ok" | "bad" | undefined;
const hint: Record<string, string> = {
  rejected_signature: "Someone sent a webhook that was not signed by the payment provider. It was ignored.",
  rejected_mismatch: "The provider reports a different amount or currency than we recorded. Not credited. Check it by hand.",
  duplicate_payment: "Money was taken for something already paid. The payment is recorded; the extra amount may need refunding.",
  unknown_reference: "A payment arrived for a reference we never created.",
  error: "Processing failed. The provider will retry; if it keeps failing, investigate.",
};

export default async function Payments() {
  const [events, s] = await Promise.all([paymentEvents(), paymentsSummary()]);
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
