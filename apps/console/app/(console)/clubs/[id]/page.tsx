import { staffCan } from "@rallix/config/staff";
import { requireAdmin } from "../../../../lib/guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Empty, Kpi, PageHead } from "../../../../components/ui";
import { ClubStatusForm } from "../../../../components/Forms";
import { ago, date, naira, uuid } from "../../../../lib/format";
import { getClub, health } from "../../../../lib/queries";

export default async function ClubDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireAdmin("clubs");
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const d = await getClub(id);
  if (!d) notFound();
  const { club: c, totals: t } = d;
  const h = health(c);
  return (
    <>
      <PageHead title={c.name} sub={`${c.slug} · ${c.location ?? "No location"} · joined ${date(c.created_at)}`} actions={<Badge tone={h.tone}>{h.label}</Badge>} />
      <div className="cs-kpis">
        <Kpi label="Active members" value={c.members} note={`${t.players} players`} />
        <Kpi label="Matches (30 days)" value={c.matches_30d} note={`${t.matches} all time · ${t.competitions} competitions`} />
        <Kpi label="Dues collected" value={naira(t.dues_paid_kobo)} note={`${t.dues_open} dues unpaid`} />
        <Kpi label="Last activity" value={ago(c.last_activity)} />
      </div>
      <div className="cs-grid cs-grid--2" style={{ marginTop: 24 }}>
        <section className="cs-card">
          <h2 className="cs-h2" style={{ marginTop: 0 }}>Owner and staff</h2>
          <dl className="cs-kv">
            <dt>Owner</dt><dd>{c.owner_name}</dd><dt>Phone</dt><dd>{c.owner_phone ?? "—"}</dd><dt>Email</dt><dd>{c.owner_email ?? "—"}</dd>
            <dt>Online dues payments</dt><dd>{c.payouts_enabled_at ? <Badge tone="ok">Active</Badge> : <Badge>Not set up</Badge>}{c.payout_bank ? ` ${c.payout_bank} ••${c.payout_last4}` : ""}</dd>
            <dt>Admins and scorers</dt><dd>{d.staff.map((s) => `${s.name} (${s.roles.filter((r) => r !== "player").join(", ")})`).join("; ") || "—"}</dd>
          </dl>
        </section>
        <section className="cs-card">
          <h2 className="cs-h2" style={{ marginTop: 0 }}>Access</h2>
          <p className="cs-muted">Status: <Badge tone={c.status === "active" ? "ok" : "bad"}>{c.status}</Badge></p>
          {staffCan(staff.role, "clubs_manage") ? <ClubStatusForm clubId={c.id} status={c.status} /> : <p className="cs-muted">Your role can look at this club but not change its status.</p>}
        </section>
      </div>
      <h2 className="cs-h2">Subscription</h2>
      {d.subs.length === 0 ? <Empty>No subscription yet. <Link href="/billing">Add one in Billing.</Link></Empty> : (
        <div className="cs-tablewrap"><table className="cs-table"><thead><tr><th>Billing</th><th>Status</th><th className="num">Amount</th><th>Renews</th></tr></thead>
          <tbody>{d.subs.map((s) => <tr key={s.id}><td>{s.period}</td><td><Badge tone={s.status === "active" ? "ok" : s.status === "past_due" ? "bad" : undefined}>{s.status.replace("_", " ")}</Badge></td><td className="num">{naira(s.amount_kobo)}</td><td>{date(s.current_period_end)}</td></tr>)}</tbody></table></div>
      )}
      <h2 className="cs-h2">Invoices</h2>
      {d.invoices.length === 0 ? <Empty>No invoices yet.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table"><thead><tr><th>Number</th><th>Period</th><th>Status</th><th className="num">Amount</th></tr></thead>
          <tbody>{d.invoices.map((i) => <tr key={i.id}><td><Link className="cs-rowlink" href={`/invoices/${i.id}`}>{i.number}</Link></td><td>{i.period_label}</td><td><Badge tone={i.status === "paid" ? "ok" : i.status === "issued" ? "warn" : undefined}>{i.status}</Badge></td><td className="num">{naira(i.amount_kobo)}</td></tr>)}</tbody></table></div>
      )}
      <h2 className="cs-h2">Issues</h2>
      {d.issues.length === 0 ? <Empty>No issues logged for this club.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table"><tbody>{d.issues.map((i) => <tr key={i.id}><td><Link className="cs-rowlink" href={`/issues/${i.id}`}>{i.title}</Link></td><td><Badge tone={i.severity === "critical" || i.severity === "high" ? "bad" : undefined}>{i.severity}</Badge></td><td>{i.status}</td><td className="num">{ago(i.created_at)}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
