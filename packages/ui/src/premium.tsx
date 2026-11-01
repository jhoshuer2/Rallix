import type { CSSProperties, ElementType, ReactNode } from "react";
import { countdown, initials, placeholderColors, scoreLine } from "./premium-utils";
import { Icon, type IconName } from "./icons";

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");

/* ---------- Photo: real upload when present, finished-looking placeholder otherwise ---------- */
export type PhotoKind = "person" | "club" | "cover";
/**
 * Every picture slot in the app uses this. With no upload it still looks designed: a brand gradient (stable per name)
 * with initials for people and clubs, or the ball motif for wide covers. Pass `alt=""` when the name is written next to it.
 */
export function Photo({ src, name, kind = "person", alt, className, style }: { src?: string | null; name: string; kind?: PhotoKind; alt?: string; className?: string; style?: CSSProperties }) {
  const label = alt ?? name;
  if (src) return <img className={cx("rx-photo", `rx-photo--${kind}`, className)} src={src} alt={label} loading="lazy" decoding="async" style={style} />;
  const { from, to } = placeholderColors(name);
  return (
    <span className={cx("rx-photo", "rx-photo--ph", `rx-photo--${kind}`, className)} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}
      style={{ ...style, background: `linear-gradient(135deg, ${from}, ${to})` }}>
      {kind === "cover" ? <span className="rx-photo__ball" aria-hidden="true" /> : <span className="rx-photo__mono" aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}

/* ---------- Section title + carousel ---------- */
/** Editorial section title with a small arrow, like "Latest results →". */
export function SectionTitle({ title, href, linkAs: L = "a", label }: { title: string; href?: string; linkAs?: ElementType; label?: string }) {
  return (
    <div className="rx-sectiontitle">
      <h2 className="rx-sectiontitle__h">{title}</h2>
      {href ? <L href={href} className="rx-sectiontitle__go" aria-label={label ?? `See all ${title}`}><Icon name="back" size={20} style={{ transform: "rotate(180deg)" }} /></L> : null}
    </div>
  );
}

/** Horizontal scroll-snap row with the next card peeking. Scrolls inside itself, never the page. */
export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rx-carousel" role="group" aria-roledescription="carousel" aria-label={label} tabIndex={0}>{children}</div>;
}

/* ---------- Hero match ---------- */
type Side = { name: string; photo?: string | null };
/** The one big moment at the top of Home: live or next match. */
export function HeroMatch({ competition, whenLabel, startsAt, live, a, b, scoreA, scoreB, href, linkAs: L = "a", cta }: {
  competition: string; whenLabel: string; startsAt?: Date | null; live?: boolean; a: Side; b: Side; scoreA?: number | null; scoreB?: number | null; href?: string; linkAs?: ElementType; cta?: string;
}) {
  const showScore = live || (scoreA != null && scoreB != null);
  return (
    <section className={cx("rx-mhero", live && "is-live")} aria-label={live ? "Live match" : "Next match"}>
      <div className="rx-mhero__top">
        <span className="rx-mhero__comp">{competition}</span>
        {live ? <span className="rx-livetag"><span className="rx-livetag__dot" aria-hidden="true" />Live</span> : startsAt ? <span className="rx-mhero__count" aria-label={`Starts in ${countdown(startsAt)}`}>{countdown(startsAt)}</span> : null}
      </div>
      <div className="rx-mhero__stage">
        <div className="rx-mhero__side"><Photo src={a.photo} name={a.name} alt="" className="rx-mhero__face" /><span className="rx-mhero__name">{a.name}</span></div>
        <div className="rx-mhero__mid">{showScore ? <span className="rx-mhero__score" aria-label={`Score ${scoreLine(scoreA, scoreB)}`}>{scoreLine(scoreA, scoreB)}</span> : <span className="rx-mhero__vs">VS</span>}</div>
        <div className="rx-mhero__side"><Photo src={b.photo} name={b.name} alt="" className="rx-mhero__face" /><span className="rx-mhero__name">{b.name}</span></div>
      </div>
      <p className="rx-mhero__when">{whenLabel}</p>
      {href && cta ? <L href={href} className="rx-btn rx-btn--block">{cta}</L> : null}
    </section>
  );
}

/* ---------- Photo-led cards for carousels ---------- */
/** A finished match: both faces side by side, the score, nothing else. */
export function ResultCard({ a, b, scoreA, scoreB, winner, competition, when, href, linkAs: L = "a" }: {
  a: Side; b: Side; scoreA: number | null; scoreB: number | null; winner?: "a" | "b" | null; competition: string; when: string; href: string; linkAs?: ElementType;
}) {
  const summary = winner ? `${winner === "a" ? a.name : b.name} won ${scoreLine(scoreA, scoreB)}` : `${a.name} vs ${b.name} ${scoreLine(scoreA, scoreB)}`;
  return (
    <L href={href} className="rx-rcard" aria-label={`${summary}. ${competition}, ${when}`}>
      <div className="rx-rcard__faces" aria-hidden="true">
        <Photo src={a.photo} name={a.name} alt="" className={cx("rx-rcard__face", winner === "b" && "is-dim")} />
        <Photo src={b.photo} name={b.name} alt="" className={cx("rx-rcard__face", winner === "a" && "is-dim")} />
        <span className="rx-rcard__score">{scoreLine(scoreA, scoreB)}</span>
      </div>
      <div className="rx-cardtext"><p className="rx-rcard__title">{summary}</p><p className="rx-rcard__sub">{when}</p></div>
    </L>
  );
}

/** MediaCard: a wide picture (placeholder until uploaded), a title and one detail. Used for competitions and anything with a cover. */
export function MediaCard({ name, detail, cover, href, linkAs: L = "a", tag, className }: { name: string; detail: string; cover?: string | null; href: string; linkAs?: ElementType; tag?: string; className?: string }) {
  return (
    <L href={href} className={cx("rx-ccard", className)}>
      <div className="rx-ccard__cover"><Photo src={cover} name={name} kind="cover" alt="" className="rx-ccard__img" />{tag ? <span className="rx-ccard__tag">{tag}</span> : null}</div>
      <div className="rx-cardtext"><p className="rx-rcard__title">{name}</p><p className="rx-rcard__sub">{detail}</p></div>
    </L>
  );
}

/* ---------- Skeleton ---------- */
/** Placeholder block that holds the final layout's shape while data loads. Decorative: wrap a page in role="status". */
export function Skeleton({ w = "100%", h = 16, round, className }: { w?: number | string; h?: number | string; round?: boolean; className?: string }) {
  return <span className={cx("rx-skel", className)} aria-hidden="true" style={{ width: w, height: h, borderRadius: round ? "50%" : undefined }} />;
}

/* ---------- Admin: club banner, attention tiles, actions, tiles ---------- */
/** Admin hero: the club itself, with this month's revenue as the one big number. */
export function ClubBanner({ name, logo, figure, figureLabel, members, membersLabel = "Members" }: { name: string; logo?: string | null; figure: string; figureLabel: string; members: number; membersLabel?: string }) {
  return (
    <section className="rx-cb" aria-label={`${name} overview`}>
      <Photo src={null} name={name} kind="cover" alt="" className="rx-cb__cover" />
      <div className="rx-cb__body">
        <Photo src={logo} name={name} kind="club" alt={`${name} logo`} className="rx-cb__logo" />
        <div className="rx-cb__main">
          <p className="rx-cb__name">{name}</p>
          <p className="rx-cb__figure">{figure}</p>
          <p className="rx-cb__label">{figureLabel}</p>
        </div>
        <div className="rx-cb__side"><b>{members}</b><span>{membersLabel}</span></div>
      </div>
    </section>
  );
}

/** One thing that needs the admin: a count, one short label, and where to go. Render nothing when there is nothing to do. */
export function AttentionTile({ count, label, href, linkAs: L = "a", tone = "warn" }: { count?: number; label: string; href: string; linkAs?: ElementType; tone?: "warn" | "go" }) {
  return (
    <L href={href} className={cx("rx-attn", `rx-attn--${tone}`)}>
      {count !== undefined ? <span className="rx-attn__n" aria-hidden="true">{count}</span> : <span className="rx-attn__n" aria-hidden="true"><Icon name="plus" size={22} /></span>}
      <span className="rx-attn__l">{count !== undefined ? <span className="rx-vh">{count} </span> : null}{label}</span>
    </L>
  );
}

/** Round quick action with a one-word label under it. */
export function ActionButton({ icon, label, href, linkAs: L = "a" }: { icon: IconName; label: string; href: string; linkAs?: ElementType }) {
  return (
    <L href={href} className="rx-act">
      <span className="rx-act__circle" aria-hidden="true"><Icon name={icon} size={24} /></span>
      <span className="rx-act__l">{label}</span>
    </L>
  );
}

/** Navigation tile: an icon and one or two words. Use in a 2-column grid. */
export function TileLink({ icon, label, href, linkAs: L = "a" }: { icon: IconName; label: string; href: string; linkAs?: ElementType }) {
  return (
    <L href={href} className="rx-tile">
      <Icon name={icon} size={26} aria-hidden="true" />
      <span>{label}</span>
    </L>
  );
}

/** Member: photo first, rank as a corner badge, name and rating as the only two lines. */
export function MemberCard({ rank, name, rating, photo, href, linkAs: L = "a" }: { rank: number; name: string; rating: number; photo?: string | null; href: string; linkAs?: ElementType }) {
  return (
    <L href={href} className="rx-mcard" aria-label={`${name}, rank ${rank}, rating ${rating}`}>
      <Photo src={photo} name={name} alt="" className="rx-mcard__photo" />
      <span className="rx-mcard__rank" aria-hidden="true">#{rank}</span>
      <span className="rx-mcard__meta"><span className="rx-mcard__name">{name}</span><span className="rx-mcard__rating">{rating}</span></span>
    </L>
  );
}

/* ---------- Page anatomy and the six card kinds ---------- */
/**
 * Every content screen: a blue band (club header, title, optional stories) over a light canvas.
 * The first card on the canvas overlaps the band. Use `flat` when the page starts with plain content instead of a card.
 */
export function PageShell({ header, title, back, action, band, flat, children }: { header?: ReactNode; title?: ReactNode; back?: ReactNode; action?: ReactNode; band?: ReactNode; flat?: boolean; children: ReactNode }) {
  return (
    <>
      <div className="rx-band">
        {header}
        {back || title || action ? <div className="rx-band__row">{back}{title ? <h1 className="rx-band__title">{title}</h1> : <span />}{action}</div> : null}
        {band}
      </div>
      <div className={cx("rx-canvas", flat && "rx-canvas--flat")}>{children}</div>
    </>
  );
}

/** Panel: the plain white surface for forms, text and groups. Not for things that have a picture or a number to show off. */
export function Panel({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return <section className={cx("rx-panel", className)} aria-label={title}>{title ? <h2 className="rx-panel__title">{title}</h2> : null}{children}</section>;
}

/** ListRow: avatar or icon, a title, one detail line, and a value or chevron on the right. Rows stack inside a `ListGroup`. */
export function ListRow({ media, title, subtitle, trailing, href, linkAs: L = "a", tone, current }: { media?: ReactNode; title: string; subtitle?: string; trailing?: ReactNode; href?: string; linkAs?: ElementType; tone?: "good" | "bad" | "warn"; current?: boolean }) {
  const body = (
    <>
      {media ? <span className="rx-lrow__media" aria-hidden="true">{media}</span> : null}
      <span className="rx-lrow__text"><span className="rx-lrow__title">{title}</span>{subtitle ? <span className="rx-lrow__sub">{subtitle}</span> : null}</span>
      {trailing ? <span className={cx("rx-lrow__end", tone && `is-${tone}`)}>{trailing}</span> : href ? <Icon name="back" size={18} style={{ transform: "rotate(180deg)", opacity: .5 }} aria-hidden="true" /> : null}
    </>
  );
  const cls = cx("rx-lrow", current && "is-current");
  return href ? <L href={href} className={cls} aria-current={current ? "true" : undefined}>{body}</L> : <div className={cls}>{body}</div>;
}
/** `bare` drops the card background so rows can sit inside a Panel. */
export const ListGroup = ({ children, label, bare }: { children: ReactNode; label?: string; bare?: boolean }) => <div className={cx("rx-lgroup", bare && "rx-lgroup--bare")} role="list" aria-label={label}>{children}</div>;

/** Icon in a round badge, for ListRow media when there is no picture (settings, payments, actions). */
export function IconBadge({ icon }: { icon: IconName }) { return <span className="rx-iconbadge"><Icon name={icon} size={22} /></span>; }

/** MetricCard: one big number with a label. Use in a `MetricGrid` (2 columns). */
export function MetricCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rx-metric">
      <span className="rx-metric__label">{label}</span>
      <span className={cx("rx-metric__value", tone && `is-${tone}`)}>{value}</span>
      {hint ? <span className="rx-metric__hint">{hint}</span> : null}
    </div>
  );
}
export const MetricGrid = ({ children }: { children: ReactNode }) => <div className="rx-metricgrid">{children}</div>;

/** One small status pill, four tones. The only badge style in the app. */
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "live" }) {
  return <span className={cx("rx-pill", `rx-pill--${tone}`)}>{children}</span>;
}
