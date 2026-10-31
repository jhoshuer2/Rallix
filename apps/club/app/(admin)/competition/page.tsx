import Link from "next/link";
import { Card, Chip, SectionHeader } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requireRole } from "../../../lib/context";
import { listCompetitions } from "../../../lib/queries";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");

export default async function Competition() {
  const ctx = await requireRole("admin");
  const comps = await inClub(ctx, (tx) => listCompetitions(tx, ctx.club.clubId));
  const latest = comps.find((c) => c.status === "active") ?? comps[0];
  return (
    <>
      <ClubHeader />
      <div className="rx-pagehead__row" style={{ alignItems: "center" }}>
        <h1 className="rx-title">Competition</h1>
        <Link className="rx-btn rx-btn--small" href="/competition/new">+ New</Link>
      </div>
      <div style={{ height: 16 }} />
      <Card variant="outline" className="rx-latest">
        <Chip tone="light">Competition</Chip>
        <p className="rx-title" style={{ fontSize: 22, margin: "16px 0" }}>{latest ? latest.name : "No competitions yet"}</p>
        {latest ? <Link className="rx-btn" href={`/competition/${latest.id}/groups`}>Resume <span className="rx-btn__ball" aria-hidden="true" /></Link> : <Link className="rx-btn" href="/competition/new">Create one</Link>}
      </Card>
      {comps.length > 0 ? <SectionHeader title="All competitions" /> : null}
      <div style={{ display: "grid", gap: 12 }}>
        {comps.map((c) => (
          <Link key={c.id} href={`/competition/${c.id}/groups`} className="rx-card" style={{ color: "var(--rx-ink)", textDecoration: "none", minHeight: 110 }}>
            <Chip tone={c.status === "active" ? "active" : "dark"}>{c.status}</Chip>{c.level ? <> <Chip tone="warn">{c.level}</Chip></> : null}
            <p style={{ fontSize: 12, margin: "20px 0 4px" }}>{fmt(c.startsOn)} – {fmt(c.endsOn)}</p>
            <p className="rx-title" style={{ fontSize: 14 }}>{c.name}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
