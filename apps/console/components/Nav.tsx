"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; count?: number };

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const current = items.filter((i) => (i.href === "/" ? path === "/" : path === i.href || path.startsWith(i.href + "/"))).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="cs-nav" aria-label="Console">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={current === i.href ? "page" : undefined}>
          {i.label}{i.count ? <span className="cs-count" aria-label={`${i.count} open`}>{i.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
