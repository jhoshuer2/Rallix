import Link from "next/link";
import { Card, Chip, SectionHeader, StatGrid } from "@rallix/ui";
import { ClubHeader } from "../../components/ClubHeader";
import { inClub, requireRole } from "../../lib/context";
import { listCompetitions, listDues, listMembers, naira, revenue } from "../../lib/queries";

export default async function Home() {
  const ctx = await requireRole("admin");
  const { members, comps, dues, month } = await inClub(ctx, async (tx) => ({
    members: await listMembers(tx, ctx.club.clubId),
    comps: await listCompetitions(tx, ctx.club.clubId),
    dues: await listDues(tx, ctx.club.clubId),
    month: await revenue(tx, ctx.club.clubId, "Month"),
  }));
  const pending = dues.filter((d) => d.status === "due" || d.status === "overdue").length;
  const active = comps.find((c) => c.status === "active");
  return (
    <>
      <ClubHeader />
      <h1 className="rx-title">Home</h1>
      <SectionHeader title="This month" />
      <StatGrid stats={[
        { label: "Members", value: String(members.length) },
        { label: "Unpaid dues", value: String(pending) },
        { label: "Revenue (30 days)", value: naira(month.total) },
        { label: "Competitions", value: String(comps.length) },
      ]} />
      <SectionHeader title="Latest competition" linkLabel="View all" href="/competition" linkAs={Link} />
      {active ? (
        <Card variant="outline">
          <Chip tone="active">Active</Chip>{active.level ? <> <Chip tone="dark">{active.level}</Chip></> : null}
          <p className="rx-title" style={{ fontSize: 20, margin: "12px 0" }}>{active.name}</p>
          <Link className="rx-btn" href={`/competition/${active.id}/groups`}>Resume <span className="rx-btn__ball" aria-hidden="true" /></Link>
        </Card>
      ) : (
        <Card variant="outline"><p style={{ margin: "0 0 12px" }}>No active competition yet.</p><Link className="rx-btn" href="/competition/new">Create one</Link></Card>
      )}
      <SectionHeader title="Quick actions" />
      <div style={{ display: "grid", gap: 12 }}>
        <Link className="rx-btn rx-btn--ghost rx-btn--block" href="/competition/new">New competition</Link>
        <Link className="rx-btn rx-btn--ghost rx-btn--block" href="/profile">Invite players</Link>
      </div>
    </>
  );
}
