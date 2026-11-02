import Link from "next/link";
import { EmptyState, FormChips, ListGroup, ListRow, MetricCard, MetricGrid, PageShell, Panel, Photo, RankChart, StatBar } from "@rallix/ui";
import { streakLabel } from "@rallix/stats";
import { ClubHeader } from "../../../../components/ClubHeader";
import { inClub, requireClub } from "../../../../lib/context";
import { listMembers, memberStats, ratingHistory } from "../../../../lib/queries";

export default async function Stats() {
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const d = await inClub(ctx, async (tx) => ({ stats: await memberStats(tx, ctx.club.clubId, me), members: await listMembers(tx, ctx.club.clubId), history: await ratingHistory(tx, me) }));
  const { record: r, h2h } = d.stats;
  const names = new Map(d.members.map((m) => [m.id, m]));
  const mine = names.get(me);
  return (
    <PageShell header={<ClubHeader />} title="Stats">
      <MetricGrid>
        <MetricCard label="Club rank" value={mine ? `#${mine.rank}` : "—"} hint={`Rating ${mine ? mine.rating : 1200}`} />
        <MetricCard label="Win rate" value={r.played ? `${r.winPct}%` : "—"} hint={r.played ? `${r.won} won, ${r.lost} lost` : "No matches yet"} tone={r.played && r.winPct >= 50 ? "good" : undefined} />
        <MetricCard label="Played" value={String(r.played)} />
        <MetricCard label="Streak" value={streakLabel(r.streak)} />
      </MetricGrid>
      {r.played === 0 ? <EmptyState compact title="No stats yet" hint="They appear after your first confirmed match." /> : (
        <>
          <Panel title={`Last ${r.form.length}, newest first`}><FormChips results={r.form} /></Panel>
          <Panel title="Games and points">
            <StatBar label="Games" left={r.gamesFor} right={r.gamesAgainst} />
            <StatBar label="Points" left={r.pointsFor} right={r.pointsAgainst} />
          </Panel>
        </>
      )}
      {d.history.length >= 2 ? (
        <Panel title="Rating over time">
          <RankChart invert caption="Your rating after each rated match (higher is better)" years={d.history.map((_, i) => String(i + 1))}
            series={[{ label: "Rating", color: "#b54829", points: d.history.map((h) => h.after) }]} />
        </Panel>
      ) : null}
      {h2h.length ? (
        <>
          <h2 className="rx-panel__title" style={{ margin: "32px 0 0" }}>Head to head</h2>
          <ListGroup label="Head to head">
            {h2h.map((h) => {
              const o = names.get(h.opponentId);
              return <ListRow key={h.opponentId} media={<Photo src={o?.photo} name={o?.name ?? "Former member"} alt="" />} title={o?.name ?? "Former member"} subtitle={`${h.won + h.lost} match${h.won + h.lost === 1 ? "" : "es"}`} trailing={`${h.won}–${h.lost}`} tone={h.won >= h.lost ? "good" : "bad"} />;
            })}
          </ListGroup>
        </>
      ) : null}
    </PageShell>
  );
}
