import Link from "next/link";
import { EmptyState, MediaCard, PageShell, SectionTitle } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requireRole } from "../../../lib/context";
import { listCompetitions } from "../../../lib/queries";

const short = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "");
const tagOf = (c: { status: string; openRegistration: boolean }) => (c.status === "active" ? "Active" : c.status === "draft" ? (c.openRegistration ? "Sign-up open" : "Draft") : c.status);
const range = (a: string | null, b: string | null) => (a && b ? `${short(a)} – ${short(b)}` : a ? `From ${short(a)}` : "Dates to be set");

export default async function Competition() {
  const ctx = await requireRole("admin");
  const comps = await inClub(ctx, (tx) => listCompetitions(tx, ctx.club.clubId));
  const latest = comps.find((c) => c.status === "active") ?? comps[0];
  const rest = comps.filter((c) => c.id !== latest?.id);
  return (
    <PageShell header={<ClubHeader />} title="Competitions" action={comps.length ? <Link className="rx-btn rx-btn--small" href="/competition/new">+ New</Link> : undefined} flat={!latest}>
      {latest ? (
        <>
          <MediaCard name={latest.name} detail={range(latest.startsOn, latest.endsOn)} tag={tagOf(latest)} href={`/competition/${latest.id}/groups`} linkAs={Link} className="rx-ccard--wide" />
          <Link className="rx-btn rx-btn--block" style={{ marginTop: 16, boxSizing: "border-box" }} href={`/competition/${latest.id}/groups`}>{latest.status === "active" ? "Resume" : latest.status === "draft" ? "Manage" : "Open"}</Link>
        </>
      ) : (
        <EmptyState title="No competitions yet" hint="Create your first one in a minute." action={<Link className="rx-btn" href="/competition/new">Create a competition</Link>} />
      )}
      {rest.length ? (
        <>
          <SectionTitle title="All competitions" />
          <div className="rx-cstack">
            {rest.map((c) => <MediaCard key={c.id} name={c.name} detail={range(c.startsOn, c.endsOn)} tag={tagOf(c)} href={`/competition/${c.id}/groups`} linkAs={Link} className="rx-ccard--wide" />)}
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
