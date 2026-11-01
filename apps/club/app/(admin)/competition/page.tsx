import Link from "next/link";
import { CoverCard, SectionTitle } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requireRole } from "../../../lib/context";
import { listCompetitions } from "../../../lib/queries";

const short = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "");
const range = (a: string | null, b: string | null) => (a && b ? `${short(a)} – ${short(b)}` : a ? `From ${short(a)}` : "Dates to be set");

export default async function Competition() {
  const ctx = await requireRole("admin");
  const comps = await inClub(ctx, (tx) => listCompetitions(tx, ctx.club.clubId));
  const latest = comps.find((c) => c.status === "active") ?? comps[0];
  const rest = comps.filter((c) => c.id !== latest?.id);
  return (
    <>
      <ClubHeader />
      <div className="rx-pagehead__row" style={{ alignItems: "center", marginTop: 8 }}>
        <h1 className="rx-title">Competitions</h1>
        <Link className="rx-btn rx-btn--small" href="/competition/new">+ New</Link>
      </div>
      {latest ? (
        <div style={{ marginTop: 16 }}>
          <CoverCard name={latest.name} detail={range(latest.startsOn, latest.endsOn)} tag={latest.status === "active" ? "Active" : latest.status} href={`/competition/${latest.id}/groups`} linkAs={Link} className="rx-ccard--wide" />
          <Link className="rx-btn rx-btn--block" style={{ marginTop: 16, boxSizing: "border-box" }} href={`/competition/${latest.id}/groups`}>{latest.status === "active" ? "Resume" : "Open"}</Link>
        </div>
      ) : (
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <p className="rx-muted" style={{ margin: "0 0 16px" }}>No competitions yet. Create your first one in a minute.</p>
          <Link className="rx-btn" href="/competition/new">Create a competition</Link>
        </div>
      )}
      {rest.length ? (
        <>
          <SectionTitle title="All competitions" />
          <div className="rx-cstack">
            {rest.map((c) => <CoverCard key={c.id} name={c.name} detail={range(c.startsOn, c.endsOn)} tag={c.status === "active" ? "Active" : c.status} href={`/competition/${c.id}/groups`} linkAs={Link} className="rx-ccard--wide" />)}
          </div>
        </>
      ) : null}
    </>
  );
}
