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
  competition: string; whenLabel: string; startsAt?: Date | null; live?: boolean; a: Side; b: Side; scoreA?: number | null; scoreB?: number | null; href: string; linkAs?: ElementType; cta: string;
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
      <L href={href} className="rx-btn rx-btn--block">{cta}</L>
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
      <p className="rx-rcard__title">{summary}</p>
      <p className="rx-rcard__sub">{when}</p>
    </L>
  );
}

/** A competition: wide cover (placeholder until the club uploads one), name and one detail. */
export function CoverCard({ name, detail, cover, href, linkAs: L = "a", tag, className }: { name: string; detail: string; cover?: string | null; href: string; linkAs?: ElementType; tag?: string; className?: string }) {
  return (
    <L href={href} className={cx("rx-ccard", className)}>
      <div className="rx-ccard__cover"><Photo src={cover} name={name} kind="cover" alt="" className="rx-ccard__img" />{tag ? <span className="rx-ccard__tag">{tag}</span> : null}</div>
      <p className="rx-rcard__title">{name}</p>
      <p className="rx-rcard__sub">{detail}</p>
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
