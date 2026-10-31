import Link from "next/link";
import { Card, Chip, SectionHeader } from "@rallix/ui";
import { ClubHeader } from "../../../components/Header";
import { competitions } from "../../../lib/mock";

export default function Competition() {
  const latest = competitions[0]!;
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
        <p className="rx-title" style={{ fontSize: 22, margin: "16px 0" }}>Latest competition</p>
        <Link className="rx-btn" href={`/competition/${latest.id}/groups`}>Resume <span className="rx-btn__ball" aria-hidden="true" /></Link>
      </Card>
      <SectionHeader title="Competition" linkLabel="View all" href="/competition" linkAs={Link} />
      <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
        {competitions.map((c) => (
          <Link key={c.id} href={`/competition/${c.id}/groups`} className="rx-card" style={{ flex: "0 0 78%", color: "var(--rx-ink)", textDecoration: "none", minHeight: 130 }}>
            <Chip tone="active">{c.status}</Chip> <Chip tone={c.level === "Senior" ? "dark" : "warn"}>{c.level}</Chip>
            <p style={{ fontSize: 11, margin: "24px 0 4px" }}>{c.dates}</p>
            <p className="rx-title" style={{ fontSize: 14 }}>{c.title}</p>
          </Link>
        ))}
      </div>
      <SectionHeader title="Where players rank" />
    </>
  );
}
