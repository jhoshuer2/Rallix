import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, Chip, ProfileHero, RankChart, StatGrid } from "@rallix/ui";
import { byId, players } from "../../../../lib/mock";

export function generateStaticParams() { return players.map((p) => ({ id: p.id })); }

export default async function Member({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = byId(id);
  if (!p) notFound();
  return (
    <>
      <ProfileHero name={p.name.split(" ")[0]!} photo={p.photo} />
      <div className="rx-hero-back"><BackButton href="/members" linkAs={Link} /></div>
      <div className="rx-sheet">
        <h1 className="rx-title" style={{ fontSize: 22 }}>{p.name} <Chip tone="active">{p.level}</Chip></h1>
        <p style={{ margin: "8px 0 0" }}>{p.country} • {p.age} yrs • {p.height}</p>
      </div>
      <div style={{ height: 16 }} />
      <h2 className="rx-section__title" style={{ marginBottom: 12 }}>Overview</h2>
      <StatGrid stats={[
        { label: "Current Rank", value: String(p.rank) },
        { label: "Titles Won", value: String(p.titles) },
        { label: "Won / Lost", value: `${p.won} / ${p.lost}` },
        { label: "Total Amount Earned", value: p.earned },
      ]} />
      <h2 className="rx-section__title" style={{ margin: "24px 0 12px" }}>Rank history</h2>
      <RankChart caption={`${p.name} rank history by year (lower is better)`} years={["2022", "2023", "2024", "2025", "2026"]}
        series={[{ label: "Highest rank of the year", color: "#b54829", points: [72, 40, 35, 18, 10] }, { label: "Year end rank", color: "#3b6ca7", points: [90, 60, 40, 30, 12] }]} />
    </>
  );
}
