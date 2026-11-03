import Link from "next/link";
import { Badge, Bars, Kpi, PageHead } from "../../components/ui";
import { ago, naira } from "../../lib/format";
import { listAudit, overview } from "../../lib/queries";

export default async function Overview() {
  const { o, signups, matches } = await overview();
  const recent = (await listAudit({})).slice(0, 8);
  const hasCharts = [...signups, ...matches].some((x: unknown) => Number((x as { n?: number; value?: number }).n ?? (x as { value?: number }).value ?? x) > 0);
  return (
    <>
      <PageHead title="Overview" sub="How the platform is doing right now." />
      <section className="cs-kpigroup" aria-label="Clubs">
        <h2 className="cs-h2" style={{ marginTop: 20 }}>Clubs</h2>
        <div className="cs-kpis">
          <Kpi label="Clubs" value={o.clubs_total} note={`${o.clubs_active} active · ${o.clubs_suspended} suspended or closed`} />
          <Kpi label="Active members" value={o.members} note={`${o.users} accounts in total`} />
          <Kpi label="Active users (7 days)" value={o.active_users_7d} note={`${o.new_users_7d} new this week`} />
          <Kpi label="Matches recorded (30 days)" value={o.matches_30d} />
        </div>
      </section>
      <section className="cs-kpigroup" aria-label="Money">
        <h2 className="cs-h2">Money</h2>
        <div className="cs-kpis">
          <Kpi label="Monthly recurring revenue" value={naira(o.mrr)} note="Active subscriptions, yearly plans ÷ 12" />
          <Kpi label="Collected (30 days)" value={naira(o.collected_30d)} note={`${naira(o.outstanding)} issued and unpaid`} />
          <Kpi label="Past-due subscriptions" value={o.past_due} />
        </div>
      </section>
      <section className="cs-kpigroup" aria-label="Health">
        <h2 className="cs-h2">Health</h2>
        <div className="cs-kpis">
          <Kpi label="Open issues" value={o.open_issues} note={o.critical_issues ? `${o.critical_issues} critical` : "None critical"} />
        </div>
      </section>
      {hasCharts ? <div className="cs-grid cs-grid--2" style={{ marginTop: 24 }}>
        <section className="cs-card"><h2 className="cs-h2" style={{ marginTop: 0 }}>New accounts per day</h2><Bars data={signups} label="New accounts per day, last 30 days" color="var(--rx-blue)" /></section>
        <section className="cs-card"><h2 className="cs-h2" style={{ marginTop: 0 }}>Matches recorded per day</h2><Bars data={matches} label="Matches recorded per day, last 30 days" /></section>
      </div> : null}
      <h2 className="cs-h2">Recent staff activity <Link href="/audit" style={{ fontSize: 13, fontFamily: "var(--rx-font-body)", fontStyle: "normal", textTransform: "none", marginLeft: 8 }}>View all</Link></h2>
      {recent.length === 0 ? <div className="cs-tablewrap"><p className="cs-empty">Nothing yet. Actions taken in this console are listed here.</p></div> : (
        <div className="cs-tablewrap"><table className="cs-table"><tbody>
          {recent.map((r) => <tr key={r.id}><td><Badge>{r.action}</Badge></td><td>{r.actor ?? "System"}</td><td className="num">{ago(r.at)}</td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}
