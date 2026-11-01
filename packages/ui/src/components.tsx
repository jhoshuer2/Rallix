import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, AnchorHTMLAttributes, ElementType } from "react";
import { Icon, type IconName } from "./icons";

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(" ");

/* ---------- Layout ---------- */
export function Screen({ children, tone = "blue", className }: { children: ReactNode; tone?: "blue" | "cream" | "canvas"; className?: string }) {
  return <div className={cx("rx-screen", tone === "cream" && "rx-screen--cream", tone === "canvas" && "rx-screen--canvas", className)}>{children}</div>;
}

export function Title({ children, as: Tag = "h1" }: { children: ReactNode; as?: "h1" | "h2" | "h3" }) {
  return <Tag className="rx-title">{children}</Tag>;
}

/* ---------- Actions ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "surface"; block?: boolean; ball?: boolean };
export function Button({ variant = "primary", block, ball, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx("rx-btn", variant !== "primary" && `rx-btn--${variant}`, block && "rx-btn--block", className)} {...rest}>
      {children}
      {ball ? <span className="rx-btn__ball" aria-hidden="true" /> : null}
    </button>
  );
}

export function IconButton({ icon, label, className, type = "button", ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} aria-label={label} className={cx("rx-iconbtn", className)} {...rest}>
      <Icon name={icon} size={20} />
    </button>
  );
}

/* ---------- Forms ---------- */
export function TextField({ label, icon, error, id, ...rest }: { label: string; icon?: IconName; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = id ?? `rx-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errId = `${inputId}-error`;
  return (
    <div className="rx-field">
      <label className="rx-label" htmlFor={inputId}>{label}</label>
      <div className="rx-input" data-invalid={error ? "true" : undefined}>
        {icon ? <Icon name={icon} size={20} /> : null}
        <input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} {...rest} />
      </div>
      {error ? <p id={errId} className="rx-error" role="alert">{error}</p> : null}
    </div>
  );
}

export type Option<T extends string> = { value: T; label: string; icon?: IconName };

/** Two-option outlined choice (e.g. No / Yes). Selected option fills white. */
export function ChoiceToggle<T extends string>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T | undefined; onChange: (v: T) => void }) {
  return (
    <div className="rx-field" role="radiogroup" aria-label={label}>
      <span className="rx-label">{label}</span>
      <div className="rx-choice">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className="rx-choice__opt" onClick={() => onChange(o.value)}>
            <span>{o.label}</span>
            {o.icon ? <Icon name={o.icon} size={20} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pill segmented control (Monthly/Yearly, Today/Week/Month/Year). */
export function Segmented<T extends string>({ label, options, value, onChange, scroll }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void; scroll?: boolean }) {
  return (
    <div className={cx("rx-seg", scroll && "rx-seg--scroll")} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className="rx-seg__opt" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className="rx-switch" onClick={() => onChange(!checked)} />;
}

export function Checkbox({ label, ...rest }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <label className="rx-checkwrap"><input type="checkbox" aria-label={label} className="rx-check" {...rest} /></label>;
}

/* ---------- Display ---------- */
export function Avatar({ src, name, large }: { src?: string; name: string; large?: boolean }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return src ? <img className={cx("rx-avatar", large && "rx-avatar--lg")} src={src} alt={name} /> : <span className={cx("rx-avatar", large && "rx-avatar--lg")} role="img" aria-label={name}>{initials}</span>;
}

export function Ball() { return <span className="rx-ball" aria-hidden="true" />; }

/* ---------- Members ---------- */
/* ---------- Header + navigation ---------- */
export function AppHeader({ clubName, clubLogo, userName, userPhoto, onClubClick, onSearch }: { clubName: string; clubLogo?: string; userName: string; userPhoto?: string; onClubClick?: () => void; onSearch?: () => void }) {
  return (
    <header className="rx-header">
      <button type="button" className="rx-header__club" onClick={onClubClick} aria-label={`Switch club, current: ${clubName}`}>
        <Avatar src={clubLogo} name={clubName} />
        <span>{clubName}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      <span className="rx-header__spacer" />
      <IconButton icon="search" label="Search" onClick={onSearch} />
      <Avatar src={userPhoto} name={userName} large />
    </header>
  );
}

export type NavItem = { key: string; label: string; icon: IconName; href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;
export function BottomNav({ items, current, label = "Main", linkAs: L = "a" }: { items: NavItem[]; current: string; label?: string; linkAs?: ElementType }) {
  return (
    <nav className="rx-nav" aria-label={label}>
      {items.map(({ key, label: text, icon, href, ...rest }) => (
        <L key={key} href={href} className="rx-nav__item" aria-current={current === key ? "page" : undefined} aria-label={text} {...rest}>
          <span className="rx-nav__icon"><Icon name={icon} size={22} /></span>
          <span className="rx-nav__label">{text}</span>
        </L>
      ))}
    </nav>
  );
}

/** Club admin tab set from the designs. Player app will use its own set. */
export const clubAdminNav = (base = ""): NavItem[] => [
  { key: "home", label: "Home", icon: "home", href: `${base}/` },
  { key: "members", label: "Members", icon: "members", href: `${base}/members` },
  { key: "competition", label: "Competition", icon: "trophy", href: `${base}/competition` },
  { key: "membership", label: "Membership", icon: "money", href: `${base}/membership` },
  { key: "profile", label: "Profile", icon: "profile", href: `${base}/profile` },
];

/** Player app tab set. */
export const playerNav = (base = "/play"): NavItem[] => [
  { key: "home", label: "Home", icon: "home", href: base },
  { key: "compete", label: "Compete", icon: "trophy", href: `${base}/compete` },
  { key: "stats", label: "Stats", icon: "trend", href: `${base}/stats` },
  { key: "ranks", label: "Ranks", icon: "members", href: `${base}/ranks` },
  { key: "me", label: "Me", icon: "profile", href: `${base}/me` },
];
