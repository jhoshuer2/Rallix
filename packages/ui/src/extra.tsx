import type { ElementType, ReactNode } from "react";
import { Icon } from "./icons";

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");
type LinkAs = ElementType;

/* ---------- Navigation ---------- */
export function BackButton({ href, label = "Back", linkAs: L = "a" }: { href: string; label?: string; linkAs?: LinkAs }) {
  return <L href={href} aria-label={label} className="rx-iconbtn rx-back"><Icon name="back" size={20} /></L>;
}

export function PageHead({ title, back, action }: { title: ReactNode; back?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rx-pagehead">
      {back ? <div className="rx-pagehead__back">{back}</div> : null}
      <div className="rx-pagehead__row">
        <h1 className="rx-title">{title}</h1>
        {action}
      </div>
    </div>
  );
}

/** Big outlined selection card with the label bottom-left (competition format and level). */
export function FormatCard({ title, href, linkAs: L = "a", hint }: { title: string; href: string; linkAs?: LinkAs; hint?: string }) {
  return (
    <L href={href} className="rx-format">
      {hint ? <span className="rx-format__hint">{hint}</span> : null}
      <span className="rx-format__title">{title}</span>
    </L>
  );
}

/* ---------- Money / members ---------- */
export type PayStatus = "paid" | "pending" | "failed" | "refunded";
export function PaymentRow({ rank, name, photo, detail, amount, status }: { rank: number; name: string; photo?: string; detail: string; amount: string; status: PayStatus }) {
  return (
    <li className="rx-pay">
      <span className="rx-pay__rank" aria-hidden="true">{rank}</span>
      {photo ? <img className="rx-pay__photo" src={photo} alt="" /> : <span className="rx-pay__photo" />}
      <span className="rx-pay__who">
        <span className="rx-pay__name">{name}</span>
        <span className="rx-pay__detail">{detail}</span>
      </span>
      <span className="rx-pay__amt">
        <span className="rx-pay__money">{amount}</span>
        <span className={cx("rx-pay__status", `rx-pay__status--${status}`)}>{status[0]!.toUpperCase() + status.slice(1)}</span>
      </span>
    </li>
  );
}

export function PromoCard({ title, cta, href, tone = "orange", linkAs: L = "a" }: { title: string; cta: string; href: string; tone?: "orange" | "green"; linkAs?: LinkAs }) {
  return (
    <div className={cx("rx-promo", `rx-promo--${tone}`)}>
      <h2 className="rx-promo__title">{title}</h2>
      <L href={href} className="rx-btn rx-btn--small">{cta}<span className="rx-btn__ball" aria-hidden="true" /></L>
    </div>
  );
}

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

export function MatchPair({ a, b, label }: { a?: Slot; b?: Slot; label?: string }) {
  return (
    <div className="rx-pair" role="group" aria-label={label ?? `${a?.name ?? "TBD"} versus ${b?.name ?? "TBD"}`}>
      <PlayerSlot slot={a} />
      <span className="rx-pair__vs" aria-hidden="true">VS</span>
      <PlayerSlot slot={b} />
    </div>
  );
}

export function BracketRound({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="rx-round">{title ? <h2 className="rx-round__title">{title}</h2> : null}{children}</div>;
}
export const Bracket = ({ children }: { children: ReactNode }) => <div className="rx-bracket">{children}</div>;

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
export function ProfileHero({ name, photo }: { name: string; photo?: string }) {
  return (
    <div className="rx-hero">
      <span className="rx-hero__name" aria-hidden="true">{name.toUpperCase()}</span>
      {photo ? <img className="rx-hero__photo" src={photo} alt={name} /> : null}
    </div>
  );
}

/* ---------- Player side ---------- */
export function RankRow({ rank, name, photo, points, you }: { rank: number; name: string; photo?: string; points: number; you?: boolean }) {
  return (
    <li className={cx("rx-pay", "rx-rankrow", you && "rx-rankrow--you")} aria-current={you ? "true" : undefined}>
      <span className="rx-pay__rank" aria-hidden="true">{rank}</span>
      {photo ? <img className="rx-pay__photo" src={photo} alt="" /> : <span className="rx-pay__photo" />}
      <span className="rx-pay__who">
        <span className="rx-pay__name">{name}{you ? " (you)" : ""}</span>
        <span className="rx-pay__detail">Rank {rank}</span>
      </span>
      <span className="rx-pay__amt"><span className="rx-pay__money">{points} pts</span></span>
    </li>
  );
}

export function FormChips({ results }: { results: Array<"W" | "L"> }) {
  return (
    <ul className="rx-form" aria-label={`Last ${results.length} matches: ${results.map((r) => (r === "W" ? "win" : "loss")).join(", ")}`}>
      {results.map((r, i) => <li key={i} className={cx("rx-form__chip", r === "W" ? "rx-form__chip--w" : "rx-form__chip--l")}><span aria-hidden="true">{r}</span></li>)}
    </ul>
  );
}

export function MatchCard({ title, when, opponent, opponentPhoto, result, href, linkAs: L = "a" }: { title: string; when: string; opponent: string; opponentPhoto?: string; result?: { won: boolean; score: string }; href?: string; linkAs?: LinkAs }) {
  const body = (
    <>
      <span className="rx-match__meta">{title} · {when}</span>
      <span className="rx-match__row">
        {opponentPhoto ? <img className="rx-match__photo" src={opponentPhoto} alt="" /> : <span className="rx-match__photo" />}
        <span className="rx-match__vs">vs <strong>{opponent}</strong></span>
        {result ? <span className={cx("rx-match__res", result.won ? "is-win" : "is-loss")}>{result.won ? "Won" : "Lost"} {result.score}</span> : <span className="rx-match__res">Upcoming</span>}
      </span>
    </>
  );
  return href ? <L href={href} className="rx-match">{body}</L> : <div className="rx-match">{body}</div>;
}

export function DueCard({ plan, amount, due, status, action }: { plan: string; amount: string; due: string; status: "due" | "paid" | "overdue"; action?: ReactNode }) {
  const label = status === "paid" ? "Paid" : status === "overdue" ? "Overdue" : "Due soon";
  return (
    <section className="rx-due" aria-label="Membership dues">
      <div className="rx-due__top">
        <span>{plan}</span>
        <span className={cx("rx-pay__status", status === "paid" ? "rx-pay__status--paid" : status === "overdue" ? "rx-pay__status--failed" : "rx-pay__status--pending")}>{label}</span>
      </div>
      <p className="rx-due__amt">{amount}</p>
      <p className="rx-due__date">{status === "paid" ? `Next due ${due}` : `Due ${due}`}</p>
      {status !== "paid" ? action : null}
    </section>
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

export function ClubRow({ name, logo, role, href, current, linkAs: L = "a" }: { name: string; logo?: string; role: string; href: string; current?: boolean; linkAs?: LinkAs }) {
  return (
    <L href={href} className="rx-clubrow" aria-current={current ? "true" : undefined}>
      {logo ? <img className="rx-avatar" src={logo} alt="" /> : <span className="rx-avatar">{name[0]}</span>}
      <span className="rx-clubrow__name">{name}</span>
      <span className="rx-chip rx-chip--light">{role}</span>
    </L>
  );
}
