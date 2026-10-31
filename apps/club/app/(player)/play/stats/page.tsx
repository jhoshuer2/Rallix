import { FormChips, RankChart, SectionHeader, StatBar, StatGrid } from "@rallix/ui";
import { byId, h2h, myStats as s } from "../../../../lib/mock";

export default function Stats() {
  const winPct = Math.round((s.won / s.played) * 100);
  return (
    <>
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Stats</h1>
      <p className="rx-muted" style={{ margin: "0 0 8px" }}>Calculated automatically from confirmed match results.</p>
      <SectionHeader title="Record and form" />
      <StatGrid stats={[{ label: "Played", value: String(s.played) }, { label: "Won / Lost", value: `${s.won} / ${s.lost}` }, { label: "Win rate", value: `${winPct}%` }, { label: "Streak", value: s.streak }]} />
      <div style={{ height: 12 }} />
      <p style={{ margin: "0 0 6px" }}>Last 5 (newest first)</p>
      <FormChips results={s.form} />
      <SectionHeader title="Points and games" />
      <div className="rx-statcard">
        <StatBar label="Games" left={s.gamesFor} right={s.gamesAgainst} />
        <StatBar label="Points" left={s.pointsFor} right={s.pointsAgainst} />
      </div>
      <SectionHeader title="Rank and Elo" />
      <RankChart caption="Elo rating by year (higher is better)" invert years={s.eloYears}
        series={[{ label: "Elo rating", color: "#b54829", points: s.eloSeries }]} />
      <div style={{ height: 12 }} />
      <RankChart caption="Club rank by year (lower number is better)" years={s.eloYears}
        series={[{ label: "Year end rank", color: "#3b6ca7", points: s.rankSeries }]} />
      <SectionHeader title="Head to head" />
      <ul className="rx-pays">
        {h2h.map((h) => {
          const o = byId(h.oppId)!;
          return (
            <li key={h.oppId} className="rx-pay">
              <span className="rx-pay__rank" aria-hidden="true">{o.rank}</span>
              <img className="rx-pay__photo" src={o.photo} alt="" />
              <span className="rx-pay__who"><span className="rx-pay__name">{o.name}</span><span className="rx-pay__detail">{h.won + h.lost} matches</span></span>
              <span className="rx-pay__amt"><span className="rx-pay__money">{h.won} – {h.lost}</span><span className={h.won >= h.lost ? "rx-pay__status rx-pay__status--paid" : "rx-pay__status rx-pay__status--failed"}>{h.won >= h.lost ? "Ahead" : "Behind"}</span></span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
