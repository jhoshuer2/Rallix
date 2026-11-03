import { requireAdmin } from "../../../../lib/guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHead } from "../../../../components/ui";
import { IssueControls, IssueNoteForm, IssueReplyForm } from "../../../../components/Forms";
import { dateTime, uuid } from "../../../../lib/format";
import { getIssue } from "../../../../lib/queries";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("support");
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const d = await getIssue(id);
  if (!d) notFound();
  const { issue: i, notes } = d;
  return (
    <>
      <PageHead title={i.title} sub={`Opened ${dateTime(i.created_at)}${i.reporter ? ` by ${i.reporter}` : ""}${i.club_name ? " · " : ""}`} actions={<Badge tone={i.severity === "critical" || i.severity === "high" ? "bad" : undefined}>{i.severity}</Badge>} />
      <p><Link href="/issues">← All issues</Link>{i.club_id ? <> · <Link href={`/clubs/${i.club_id}`}>{i.club_name}</Link></> : null}</p>
      <section className="cs-card"><IssueControls id={i.id} status={i.status} severity={i.severity} />{i.resolved_at ? <p className="cs-hint">Resolved {dateTime(i.resolved_at)}</p> : null}</section>
      {i.body ? <section className="cs-card" style={{ marginTop: 16 }}><h2 className="cs-h2" style={{ marginTop: 0 }}>Details</h2><p className="cs-pre">{i.body}</p></section> : null}
      <h2 className="cs-h2">Notes</h2>
      {notes.length === 0 ? <p className="cs-muted">No notes yet.</p> : notes.map((n) => <section key={n.id} className="cs-card" style={{ marginBottom: 10 }}><p className="cs-eyebrow">{n.author ?? "Unknown"}{n.emailed_at ? " · emailed to the reporter" : ""} · {dateTime(n.created_at)}</p><p className="cs-pre" style={{ margin: 0 }}>{n.body}</p></section>)}
      {i.source === "club" ? <div className="cs-card" style={{ marginTop: 16 }}><IssueReplyForm id={i.id} /></div> : null}
      <div className="cs-card" style={{ marginTop: 16 }}><IssueNoteForm id={i.id} /></div>
    </>
  );
}
