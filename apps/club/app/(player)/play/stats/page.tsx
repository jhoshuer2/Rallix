import { FormChips, RankChart, SectionHeader, StatBar, StatGrid } from "@rallix/ui";
import { streakLabel } from "@rallix/stats";
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
    <>
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Stats</h1>
      <p className="rx-muted" style={{ margin: "0 0 8px" }}>Calculated automatically from confirmed match results.</p>
      {r.played === 0 ? <p>No matches recorded yet. Your stats appear after your first confirmed match.</p> : (
        <>
          <SectionHeader title="Record and form" />
          <StatGrid stats={[{ label: "Played", value: String(r.played) }, { label: "Won / Lost", value: `${r.won} / ${r.lost}` }, { label: "Win rate", value: `${r.winPct}%` }, { label: "Streak", value: streakLabel(r.streak) }]} />
          <div style={{ height: 12 }} />
          <p style={{ margin: "0 0 6px" }}>Last {r.form.length} (newest first)</p>
          <FormChips results={r.form} />
          <SectionHeader title="Points and games" />
          <div className="rx-statcard">
            <StatBar label="Games" left={r.gamesFor} right={r.gamesAgainst} />
            <StatBar label="Points" left={r.pointsFor} right={r.pointsAgainst} />
          </div>
        </>
      )}
      <SectionHeader title="Rating" />
      <StatGrid stats={[{ label: "Club rating", value: mine ? String(mine.rating) : "1200" }, { label: "Club rank", value: mine ? String(mine.rank) : "—" }]} />
      <div style={{ height: 12 }} />
      {d.history.length >= 2 ? (
        <RankChart invert caption="Your rating after each rated match (higher is better)" years={d.history.map((_, i) => String(i + 1))}
          series={[{ label: "Rating", color: "#b54829", points: d.history.map((h) => h.after) }]} />
      ) : <p className="rx-muted">Your rating chart appears after two rated matches.</p>}
      {h2h.length ? (
        <>
          <SectionHeader title="Head to head" />
          <ul className="rx-pays">
            {h2h.map((h) => {
              const o = names.get(h.opponentId);
              return (
                <li key={h.opponentId} className="rx-pay">
                  <span className="rx-pay__rank" aria-hidden="true">{o?.rank ?? ""}</span>
                  {o?.photo ? <img className="rx-pay__photo" src={o.photo} alt="" /> : <span className="rx-pay__photo" />}
                  <span className="rx-pay__who"><span className="rx-pay__name">{o?.name ?? "Former member"}</span><span className="rx-pay__detail">{h.won + h.lost} match{h.won + h.lost === 1 ? "" : "es"}</span></span>
                  <span className="rx-pay__amt"><span className="rx-pay__money">{h.won} – {h.lost}</span><span className={h.won >= h.lost ? "rx-pay__status rx-pay__status--paid" : "rx-pay__status rx-pay__status--failed"}>{h.won > h.lost ? "Ahead" : h.won === h.lost ? "Level" : "Behind"}</span></span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </>
  );
}
