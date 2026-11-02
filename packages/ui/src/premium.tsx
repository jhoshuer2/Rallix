import { BALL_SRC } from "./empty-ball";
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
      {href ? <L href={href} className="rx-sectiontitle__go" aria-label={label ?? `See all ${title}`}><Icon name="forward" size={22} /></L> : null}
    </div>
  );
}

/** Horizontal scroll-snap row with the next card peeking. Scrolls inside itself, never the page. */
export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rx-carousel" role="group" aria-roledescription="carousel" aria-label={label} tabIndex={0}>{children}</div>;
}

/* ---------- Hero match ---------- */
type Side = { name: string; photo?: string | null };
/**
 * The one big moment at the top of Home: live, next or just finished. A scoreboard on the blue hero block:
 * meta line, player A row, a status pill between two rules, player B row, one button.
 */
export function HeroMatch({ competition, whenLabel, startsAt, live, a, b, scoreA, scoreB, href, linkAs: L = "a", cta }: {
  competition: string; whenLabel: string; startsAt?: Date | null; live?: boolean; a: Side; b: Side; scoreA?: number | null; scoreB?: number | null; href?: string; linkAs?: ElementType; cta?: string;
}) {
  const showScore = live || (scoreA != null && scoreB != null);
  const status = live ? "Live now" : showScore ? "Full time" : startsAt ? `Starts in ${countdown(startsAt)}` : "Upcoming";
  const row = (p: Side, score?: number | null) => (
    <div className="rx-mhero__row">
      <Photo src={p.photo} name={p.name} alt="" className="rx-mhero__face" />
      <span className="rx-mhero__name">{p.name}</span>
      {showScore ? <span className="rx-mhero__score" aria-hidden="true">{score ?? 0}</span> : null}
    </div>
  );
  return (
    <section className={cx("rx-mhero", live && "is-live")} aria-label={live ? "Live match" : showScore ? "Match result" : "Next match"}>
      <p className="rx-mhero__meta"><span>{whenLabel}</span><span aria-hidden="true" className="rx-mhero__sep" /><span>{competition}</span></p>
      {row(a, scoreA)}
      <div className="rx-mhero__mid" role="status">
        <span aria-hidden="true" className="rx-mhero__rule" />
        <span className={cx("rx-mhero__status", live && "is-live")}>{live ? <span className="rx-livetag__dot" aria-hidden="true" /> : null}{status}</span>
        <span aria-hidden="true" className="rx-mhero__rule" />
      </div>
      {row(b, scoreB)}
      {showScore ? <p className="rx-vh">Score {scoreLine(scoreA, scoreB)}</p> : null}
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

/* ---------- Admin: club hero, attention tiles, actions, tiles ---------- */
/** Admin hero on the blue block: the club's logo and name, this month's revenue as the one big number, members count. */
export function ClubBanner({ name, logo, cover, figure, figureLabel, members, membersLabel = "Members" }: { name: string; logo?: string | null; /** Optional wide picture shown behind the club details. */ cover?: string | null; figure: string; figureLabel: string; members: number; membersLabel?: string }) {
  // Only plain web addresses or local paths go into CSS (the database enforces this too).
  const bg = cover && /^(https:\/\/|\/(?!\/))[^"'()\s\\]+$/.test(cover) ? { backgroundImage: `linear-gradient(180deg, rgba(8,18,53,.35), rgba(8,18,53,.78)), url("${cover}")` } : undefined;
  return (
    <section className={cx("rx-cb", bg && "rx-cb--cover")} style={bg} aria-label={`${name} overview`}>
      <div className="rx-cb__head"><Photo src={logo} name={name} kind="club" alt={`${name} logo`} className="rx-cb__logo" /><p className="rx-cb__name">{name}</p></div>
      <div className="rx-cb__stats">
        <div><p className="rx-cb__figure">{figure}</p><p className="rx-cb__label">{figureLabel}</p></div>
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
 * Every content screen. Three layouts, picked by what you pass:
 * - Home (`lead`): a flat blue block holding the club header, a greeting and the hero; highlights sit on white right under it.
 * - Tab (`title`): a white app bar with the club header, then a large serif title on the light canvas.
 * - Detail (`back`): a white app bar with a back button and a centred title.
 * The `band` prop is the stories row (Home). `flat` is accepted for older callers and ignored.
 */
export function PageShell({ header, title, back, action, band, lead, home, children }: { header?: ReactNode; title?: ReactNode; back?: ReactNode; action?: ReactNode; band?: ReactNode; lead?: ReactNode; home?: boolean; flat?: boolean; children: ReactNode }) {
  if (lead || home) {
    return (
      <>
        <div className="rx-top rx-top--blue">{back ? <div className="rx-top__backrow">{back}</div> : header}{title ? <h1 className="rx-top__greeting">{title}</h1> : null}{lead}</div>
        {band ? <div className="rx-storiesbar">{band}</div> : null}
        <div className="rx-canvas">{children}</div>
      </>
    );
  }
  if (back) {
    return (
      <>
        <div className="rx-top rx-top--light"><div className="rx-detailbar">{back}<h1 className="rx-detailbar__title">{title}</h1><span className="rx-detailbar__end">{action}</span></div></div>
        <div className="rx-canvas">{children}</div>
      </>
    );
  }
  return (
    <>
      <div className="rx-top rx-top--light">{header}</div>
      <div className="rx-canvas">
        {title || action ? <div className="rx-pagetitle"><h1 className="rx-pagetitle__h">{title}</h1>{action}</div> : null}
        {children}
      </div>
    </>
  );
}

/** Panel: the plain white surface for forms, text and groups. Not for things that have a picture or a number to show off. */
export function Panel({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return <section className={cx("rx-panel", className)} aria-label={title}>{title ? <h2 className="rx-panel__title">{title}</h2> : null}{children}</section>;
}

/** ListRow: avatar or icon, a title, one detail line, and a value or chevron on the right. Rows stack inside a `ListGroup`. */
export function ListRow({ media, title, subtitle, eyebrow, size, trailing, href, linkAs: L = "a", tone, current, ariaLabel }: { media?: ReactNode; title: string; subtitle?: string; /** Small blue category label above the title, like "PODCAST". */ eyebrow?: string; /** `lg`: a bigger rectangular picture on the left, like a news row. */ size?: "lg"; trailing?: ReactNode; href?: string; linkAs?: ElementType; tone?: "good" | "bad" | "warn"; current?: boolean; ariaLabel?: string }) {
  const body = (
    <>
      {media ? <span className="rx-lrow__media" aria-hidden="true">{media}</span> : null}
      <span className="rx-lrow__text">{eyebrow ? <span className="rx-lrow__eyebrow">{eyebrow}</span> : null}<span className="rx-lrow__title">{title}</span>{subtitle ? <span className="rx-lrow__sub">{subtitle}</span> : null}</span>
      {trailing ? <span className={cx("rx-lrow__end", tone && `is-${tone}`)}>{trailing}</span> : href ? <Icon name="forward" size={20} className="rx-lrow__chev" aria-hidden="true" /> : null}
    </>
  );
  const cls = cx("rx-lrow", size === "lg" && "rx-lrow--lg", current && "is-current");
  return href ? <L href={href} className={cls} aria-current={current ? "true" : undefined} aria-label={ariaLabel}>{body}</L> : <div className={cls}>{body}</div>;
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
export const MetricGrid = ({ children, kpi }: { children: ReactNode; kpi?: boolean }) => <div className={cx("rx-metricgrid", kpi && "rx-metricgrid--kpi")}>{children}</div>;

/** One small status pill, four tones. The only badge style in the app. */
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "live" }) {
  return <span className={cx("rx-pill", `rx-pill--${tone}`)}>{children}</span>;
}

/* ---------- Celebrations: birthdays and anniversaries, LinkedIn-style ---------- */
export type CelebrationItem = { id: string; name: string; photo?: string | null; label: string; kind: "birthday" | "anniversary" | "new" };
const celebIcon: Record<CelebrationItem["kind"], IconName> = { birthday: "cake", anniversary: "medal", new: "user-add" };
/** A row of people with a speech-bubble label above each photo ("Birthday yesterday"). Names only, never ages. */
export function Celebrations({ items, label = "Celebrations" }: { items: CelebrationItem[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="rx-celebs" role="list" aria-label={label} tabIndex={0}>
      {items.map((c) => (
        <div className="rx-celeb" role="listitem" key={c.id}>
          <span className="rx-celeb__bubble"><span className={cx("rx-celeb__icon", `is-${c.kind}`)} aria-hidden="true"><Icon name={celebIcon[c.kind]} size={16} /></span>{c.label}</span>
          <Photo src={c.photo} name={c.name} alt="" className="rx-celeb__photo" />
          <span className="rx-celeb__name">{c.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Entry and public screens ---------- */
/**
 * Sign-in, onboarding, join, suspended and the public pay pages: the blue top carries the Rallix mark and a serif title,
 * a white sheet below holds the form. Controls inside get the same light styles as the rest of the app.
 */
export function EntryShell({ title, subtitle, children, hero }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode; hero?: ReactNode }) {
  return (
    <main className="rx-entry">
      <div className="rx-entry__top">
        <p className="rx-entry__mark"><span className="rx-ball" aria-hidden="true" />Rallix</p>
        <h1 className="rx-entry__title">{title}</h1>
        {subtitle ? <p className="rx-entry__sub">{subtitle}</p> : null}
        {hero}
      </div>
      <div className="rx-entry__sheet rx-canvas">{children}</div>
    </main>
  );
}

/** ListRow with a 44px checkbox on the right, for choosing people. The whole row is the click target. */
export function CheckRow({ media, title, subtitle, checked, onChange }: { media?: ReactNode; title: string; subtitle?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="rx-lrow rx-checkrow">
      {media ? <span className="rx-lrow__media" aria-hidden="true">{media}</span> : null}
      <span className="rx-lrow__text"><span className="rx-lrow__title">{title}</span>{subtitle ? <span className="rx-lrow__sub">{subtitle}</span> : null}</span>
      <input type="checkbox" className="rx-checkrow__box" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={`Include ${title}`} />
    </label>
  );
}

/** Buttons that belong to the row above (for example "Paid cash" under an unpaid due). Sits inside a ListGroup. */
export const ListActions = ({ children }: { children: ReactNode }) => <div className="rx-lactions">{children}</div>;


/** One stacked bar with a legend: parts add up to the whole. Used for membership status. */
export function StackedBar({ parts, label }: { parts: Array<{ label: string; value: number; tone: "good" | "warn" | "bad" }>; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="rx-sbar">
      <div className="rx-sbar__track" role="img" aria-label={`${label}: ${parts.map((p) => `${p.value} ${p.label}`).join(", ")}`}>
        {total ? parts.filter((p) => p.value > 0).map((p) => <span key={p.label} className={`rx-sbar__part rx-sbar__part--${p.tone}`} style={{ flexGrow: p.value }} />) : null}
      </div>
      <ul className="rx-sbar__legend">
        {parts.map((p) => <li key={p.label}><span className={`rx-sbar__dot rx-sbar__part--${p.tone}`} aria-hidden="true" /><b>{p.value}</b> {p.label}</li>)}
      </ul>
    </div>
  );
}


/* ---------- Empty state: two rackets rallying a ball ---------- */
const RacketA = () => (
  <svg viewBox="0 0 89 94" width="64" height="68" aria-hidden="true" focusable="false">
    <path d="M17.55 76.58C20.73 73.97 33.63 56.88 29.54 47.13L48.83 62.61c-.03.19-.1.56-.12.58C38.31 61.3 24.6 77.75 22.73 81.41z" fill="#D8C6AC" stroke="#D8C6AC" strokeWidth="2" />
    <path d="M32.81 57.44l5.85 4.7L22.62 81.32l-5.85-4.7z" fill="#D57440" />
    <path d="M32.86 58.77l4.39 3.52L22.56 79.99l-4.39-3.52z" fill="#BE4A1D" />
    <ellipse cx="50.88" cy="37.33" rx="23.5" ry="29" transform="rotate(38.75 50.88 37.33)" fill="#62D8F7" />
    <ellipse cx="51.66" cy="37.95" rx="23.5" ry="29" transform="rotate(38.75 51.66 37.95)" fill="#D03241" />
  </svg>
);
const RacketB = () => (
  <svg viewBox="0 0 85 95" width="62" height="69" aria-hidden="true" focusable="false">
    <path d="M62.01 81.74c-1.47-3.85-13.55-21.52-24.09-20.76l20.82-13.34c.17.09.5.28.51.3-5.1 9.25 6.11 27.49 8.99 30.43z" fill="#D8C6AC" stroke="#D8C6AC" strokeWidth="2" />
    <path d="M48.73 61.18l6.32-4.05 13.07 21.32-6.32 4.05z" fill="#D57440" />
    <path d="M50.01 61.55l4.74-3.04 12.09 19.57-4.74 3.03z" fill="#BE4A1D" />
    <ellipse cx="35.43" cy="37.64" rx="23.5" ry="29" transform="rotate(-32.65 35.43 37.64)" fill="#62D8F7" />
    <ellipse cx="36.27" cy="37.1" rx="23.5" ry="29" transform="rotate(-32.65 36.27 37.1)" fill="#1d1d22" />
  </svg>
);

/** Quiet empty state: a small rally animation, one line of text, at most one button. Decorative art is hidden from screen readers. */
export function EmptyState({ title, hint, action, compact }: { title: string; hint?: string; action?: ReactNode; /** Smaller art and title, for use inside a panel or under a toolbar. */ compact?: boolean }) {
  return (
    <div className={cx("rx-es", compact && "rx-es--compact")}>
      <div className="rx-es__art" aria-hidden="true">
        <span className="rx-es__racket rx-es__racket--a"><RacketA /></span>
        <span className="rx-es__racket rx-es__racket--b"><RacketB /></span>
        <span className="rx-es__ball"><img src={BALL_SRC} width={36} height={36} alt="" draggable={false} /></span>
      </div>
      <p className="rx-es__title">{title}</p>
      {hint ? <p className="rx-es__hint">{hint}</p> : null}
      {action ? <div className="rx-es__action">{action}</div> : null}
    </div>
  );
}
