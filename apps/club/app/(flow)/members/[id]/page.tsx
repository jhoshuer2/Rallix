import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, Chip, ProfileHero, RankChart, StatGrid } from "@rallix/ui";
import { streakLabel } from "@rallix/stats";
import { inClub, requireRole } from "../../../../lib/context";
import { ageOf, listMembers, memberStats, ratingHistory } from "../../../../lib/queries";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Member({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireRole("admin");
  const data = await inClub(ctx, async (tx) => {
    const p = (await listMembers(tx, ctx.club.clubId)).find((m) => m.id === id);
    if (!p) return null;
    return { p, stats: await memberStats(tx, ctx.club.clubId, id), history: await ratingHistory(tx, id) };
  });
  if (!data) notFound();
  const { p, stats: { record: r }, history } = data;
  const age = ageOf(p.dob);
  return (
    <>
      <ProfileHero name={p.name.split(" ")[0]!} photo={p.photo ?? undefined} />
      <div className="rx-hero-back"><BackButton href="/members" linkAs={Link} /></div>
      <div className="rx-sheet">
        <h1 className="rx-title" style={{ fontSize: 22 }}>{p.name} <Chip tone="active">{p.level}</Chip></h1>
        <p style={{ margin: "8px 0 0" }}>{p.country}{age ? ` • ${age} yrs` : ""}{p.heightCm ? ` • ${p.heightCm} cm` : ""}</p>
      </div>
      <div style={{ height: 16 }} />
      <h2 className="rx-section__title" style={{ marginBottom: 12 }}>Overview</h2>
      <StatGrid stats={[
        { label: "Club rank", value: String(p.rank) },
        { label: "Rating", value: String(p.rating) },
        { label: "Won / Lost", value: `${r.won} / ${r.lost}` },
        { label: "Streak", value: streakLabel(r.streak) },
      ]} />
      <h2 className="rx-section__title" style={{ margin: "24px 0 12px" }}>Rating history</h2>
      {history.length >= 2 ? (
        <RankChart invert caption={`${p.name} rating after each match (higher is better)`} years={history.map((_, i) => String(i + 1))}
          series={[{ label: "Rating", color: "#b54829", points: history.map((h) => h.after) }]} />
      ) : <p className="rx-muted">History appears after this player’s first two rated matches.</p>}
    </>
  );
}
