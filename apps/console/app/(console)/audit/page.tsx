import Link from "next/link";
import { Badge, Empty, PageHead } from "../../../components/ui";
import { dateTime } from "../../../lib/format";
import { listAudit } from "../../../lib/queries";

export default async function Audit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const sp = await searchParams;
  const rows = await listAudit(sp);
  return (
    <>
      <PageHead title="Audit log" sub="Every change made in this console. Showing the latest 200." />
      <form className="cs-filters" role="search">
        <label className="cs-field"><span>Action starts with</span><input name="action" defaultValue={sp.action} placeholder="e.g. club, invoice, issue" /></label>
        <button className="cs-btn">Filter</button>{sp.action ? <Link className="cs-btn cs-btn--ghost" href="/audit">Clear</Link> : null}
      </form>
      {rows.length === 0 ? <Empty>No matching entries.</Empty> : (
        <div className="cs-tablewrap"><table className="cs-table">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td style={{ whiteSpace: "nowrap" }}>{dateTime(r.at)}</td><td>{r.actor ?? "System"}</td><td><Badge>{r.action}</Badge></td>
              <td><code style={{ fontSize: 12 }}>{r.meta ? JSON.stringify(r.meta) : ""}</code></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
