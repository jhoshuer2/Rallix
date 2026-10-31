import Link from "next/link";
import { Badge, Empty, PageHead } from "../../../components/ui";
import { NewIssueForm } from "../../../components/Forms";
import { ago } from "../../../lib/format";
import { clubOptions, listIssues } from "../../../lib/queries";

const sevTone = (s: string) => (s === "critical" || s === "high" ? "bad" : s === "normal" ? "warn" : undefined) as "bad" | "warn" | undefined;

export default async function Issues({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string; new?: string }> }) {
  const sp = await searchParams;
  const [rows, clubs] = await Promise.all([listIssues(sp), clubOptions()]);
  const tabs = [["", "Open"], ["resolved", "Resolved"], ["closed", "Closed"], ["all", "All"]] as const;
  return (
    <>
      <PageHead title="Issues" sub="Bugs and support problems reported by clubs or found by the team." actions={<Link className="cs-btn" href="/issues?new=1">New issue</Link>} />
      {sp.new ? <div style={{ marginBottom: 20 }}><NewIssueForm clubs={clubs} /></div> : null}
      <nav className="cs-tabs" aria-label="Issue status">{tabs.map(([k, l]) => <Link key={k} href={k ? `/issues?status=${k}` : "/issues"} aria-current={(sp.status ?? "") === k ? "page" : undefined}>{l}</Link>)}</nav>
      {rows.length === 0 ? <Empty>No issues here. Nice.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table">
          <thead><tr><th>Issue</th><th>Severity</th><th>Status</th><th>Club</th><th>Assigned</th><th className="num">Updated</th></tr></thead>
          <tbody>{rows.map((i) => (
            <tr key={i.id}>
              <td><Link className="cs-rowlink" href={`/issues/${i.id}`}>{i.title}</Link></td>
              <td><Badge tone={sevTone(i.severity)}>{i.severity}</Badge></td><td>{i.status}</td><td>{i.club_name ?? "—"}</td><td>{i.assignee ?? "Unassigned"}</td><td className="num">{ago(i.updated_at)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
