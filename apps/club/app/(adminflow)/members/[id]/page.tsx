import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, MetricCard, MetricGrid, PageShell, Panel, Photo, Pill, RankChart } from "@rallix/ui";
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
    <PageShell home back={<BackButton href="/members" linkAs={Link} />} title={p.name}
      lead={
        <div className="rx-profile">
          <Photo src={p.photo} name={p.name} alt="" className="rx-profile__photo" />
          <div className="rx-profile__facts">
            <div className="rx-profile__pills"><Pill tone="success">{p.level}</Pill><Pill>{p.country}</Pill></div>
            <span>{[age ? `${age} yrs` : null, p.heightCm ? `${p.heightCm} cm` : null].filter(Boolean).join(" · ") || "Profile details not added yet"}</span>
          </div>
        </div>
      }>
      <MetricGrid>
        <MetricCard label="Club rank" value={`#${p.rank}`} hint={`Rating ${p.rating}`} />
        <MetricCard label="Won / lost" value={`${r.won} / ${r.lost}`} />
        <MetricCard label="Win rate" value={r.played ? `${r.winPct}%` : "—"} />
        <MetricCard label="Streak" value={streakLabel(r.streak)} />
      </MetricGrid>
      {history.length >= 2 ? (
        <Panel title="Rating over time">
          <RankChart invert caption={`${p.name} rating after each match (higher is better)`} years={history.map((_, i) => String(i + 1))}
            series={[{ label: "Rating", color: "#1450c8", points: history.map((h) => h.after) }]} />
        </Panel>
      ) : <p className="rx-muted" style={{ marginTop: 16 }}>History appears after this player’s first two rated matches.</p>}
    </PageShell>
  );
}
