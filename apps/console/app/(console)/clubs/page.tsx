import { requireAdmin } from "../../../lib/guard";
import Link from "next/link";
import { Badge, Empty, PageHead } from "../../../components/ui";
import { ago, date } from "../../../lib/format";
import { health, listClubs } from "../../../lib/queries";

export default async function Clubs({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin("clubs");
  const sp = await searchParams;
  const clubs = await listClubs(sp);
  return (
    <>
      <PageHead title="Clubs" sub={`${clubs.length} club${clubs.length === 1 ? "" : "s"}${sp.q || sp.status ? " match your filters" : ""}.`} />
      <form className="cs-filters" role="search">
        <label className="cs-field"><span>Search</span><input name="q" defaultValue={sp.q} placeholder="Club, owner or phone" /></label>
        <label className="cs-field"><span>Status</span>
          <select name="status" defaultValue={sp.status ?? ""}><option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></label>
        <button className="cs-btn">Filter</button>
        {sp.q || sp.status ? <Link className="cs-btn cs-btn--ghost" href="/clubs">Clear</Link> : null}
      </form>
      {clubs.length === 0 ? <Empty>No clubs match.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table">
          <thead><tr><th>Club</th><th>Owner</th><th>Health</th><th>Subscription</th><th className="num">Members</th><th className="num">Matches (30d)</th><th>Last activity</th><th>Joined</th></tr></thead>
          <tbody>{clubs.map((c) => {
            const h = health(c);
            return (
              <tr key={c.id}>
                <td><Link className="cs-rowlink" href={`/clubs/${c.id}`}>{c.name}</Link><br /><span className="cs-hint">{c.slug}{c.location ? ` · ${c.location}` : ""}</span></td>
                <td>{c.owner_name}<br /><span className="cs-hint">{c.owner_phone ?? ""}</span></td>
                <td><Badge tone={h.tone}>{h.label}</Badge></td>
                <td>{c.sub_status ? <Badge tone={c.sub_status === "active" ? "ok" : c.sub_status === "past_due" ? "bad" : undefined}>{c.sub_status.replace("_", " ")}</Badge> : <span className="cs-hint">None</span>}</td>
                <td className="num">{c.members}</td><td className="num">{c.matches_30d}</td><td>{ago(c.last_activity)}</td><td>{date(c.created_at)}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
