import type { ElementType, ReactNode } from "react";
import { Icon } from "./icons";

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");
type LinkAs = ElementType;

/* ---------- Navigation ---------- */
export function BackButton({ href, label = "Back", linkAs: L = "a" }: { href: string; label?: string; linkAs?: LinkAs }) {
  return <L href={href} aria-label={label} className="rx-iconbtn rx-back"><Icon name="back" size={20} /></L>;
}

/* ---------- Money / members ---------- */
export type PayStatus = "paid" | "pending" | "failed" | "refunded";
export function RevenueCard({ period, onPeriod, amount, delta, bars }: { period: string; onPeriod: (p: string) => void; amount: string; delta: string; bars: number[] }) {
  const periods = ["Today", "Week", "Month", "Year"];
  const max = Math.max(1, ...bars);
  return (
    <section className="rx-revenue" aria-label="Revenue">
      <div className="rx-seg" role="radiogroup" aria-label="Revenue period">
        {periods.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} className="rx-seg__opt" onClick={() => onPeriod(p)}>{p}</button>
        ))}
      </div>
      <p className="rx-revenue__label">{period}’s Revenue</p>
      <p className="rx-revenue__amount">{amount} <span className="rx-revenue__delta">{delta}</span></p>
      <div className="rx-revenue__bars" role="img" aria-label={`Revenue bars: ${bars.join(", ")}`}>
        {bars.map((b, i) => <span key={i} style={{ height: `${Math.max(8, (b / max) * 100)}%` }} className={i === 0 ? "is-hot" : undefined} />)}
      </div>
    </section>
  );
}

/* ---------- Competition ---------- */
export type Slot = { rank: number; name: string; photo?: string; scores?: Array<string | number>; winner?: boolean };
export function PlayerSlot({ slot, tbd }: { slot?: Slot; tbd?: boolean }) {
  if (!slot || tbd) {
    return <div className="rx-slot rx-slot--tbd"><span className="rx-slot__rank">?</span><span className="rx-slot__photo" /><span className="rx-slot__name">Player</span></div>;
  }
  return (
    <div className={cx("rx-slot", slot.winner && "rx-slot--win")}>
      <span className="rx-slot__rank">{slot.rank}</span>
      {slot.photo ? <img className="rx-slot__photo" src={slot.photo} alt="" /> : <span className="rx-slot__photo" />}
      <span className="rx-slot__name">{slot.name}</span>
      {slot.scores ? <span className="rx-slot__scores">{slot.scores.map((s, i) => <span key={i}>{s}</span>)}</span> : null}
    </div>
  );
}

/** Live scoring tile. Tap the number to award a point. Large target by design. */
export function ScoreTile({ name, score, dim, onPoint }: { name: string; score: number; dim?: boolean; onPoint: () => void }) {
  return (
    <button type="button" className={cx("rx-score", dim && "rx-score--dim")} onClick={onPoint} aria-label={`Point to ${name}. Current score ${score}`}>
      <span className="rx-score__num" aria-live="polite">{score}</span>
    </button>
  );
}

/* ---------- Charts ---------- */
export type Series = { label: string; color: string; points: number[] };
/** Rank history. Lower rank number is better, so the axis is inverted. Includes a table alternative. */
export function RankChart({ years, series, caption, invert }: { years: string[]; series: Series[]; caption: string; invert?: boolean }) {
  const W = 360, H = 220, pad = 28;
  const all = series.flatMap((s) => s.points);
  const min = Math.min(...all), max = Math.max(...all);
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, years.length - 1);
  const y = (v: number) => { const t = (v - min) / Math.max(1, max - min); return pad + (invert ? 1 - t : t) * (H - pad * 2); };
  return (
    <figure className="rx-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
        {years.map((yr, i) => <text key={yr} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor">{yr}</text>)}
        {series.map((s) => (
          <g key={s.label}>
            <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {s.points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="#fff" stroke={s.color} strokeWidth="2" />)}
          </g>
        ))}
      </svg>
      <ul className="rx-chart__legend">
        {series.map((s) => <li key={s.label}><span style={{ background: s.color }} />{s.label}</li>)}
      </ul>
      <table className="rx-sr-only">
        <caption>{caption}</caption>
        <thead><tr><th>Year</th>{series.map((s) => <th key={s.label}>{s.label}</th>)}</tr></thead>
        <tbody>{years.map((yr, i) => <tr key={yr}><td>{yr}</td>{series.map((s) => <td key={s.label}>{s.points[i]}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}

/* ---------- Profile ---------- */
/* ---------- Player side ---------- */
export function FormChips({ results }: { results: Array<"W" | "L"> }) {
  return (
    <ul className="rx-form" aria-label={`Last ${results.length} matches: ${results.map((r) => (r === "W" ? "win" : "loss")).join(", ")}`}>
      {results.map((r, i) => <li key={i} className={cx("rx-form__chip", r === "W" ? "rx-form__chip--w" : "rx-form__chip--l")}><span aria-hidden="true">{r}</span></li>)}
    </ul>
  );
}

/** Two-sided bar, e.g. games won vs lost. */
export function StatBar({ label, left, right }: { label: string; left: number; right: number }) {
  const total = Math.max(1, left + right);
  return (
    <div className="rx-sbar">
      <div className="rx-sbar__top"><span>{left}</span><span>{label}</span><span>{right}</span></div>
      <div className="rx-sbar__track" role="img" aria-label={`${label}: ${left} for, ${right} against`}>
        <span style={{ width: `${(left / total) * 100}%` }} />
      </div>
    </div>
  );
}

