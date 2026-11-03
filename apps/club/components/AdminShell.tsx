"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav, clubAdminNav } from "@rallix/ui";

export function AdminNav({ badges = {} }: { badges?: Record<string, number> }) {
  const path = usePathname();
  const items = clubAdminNav().map((i) => ({ ...i, badge: badges[i.key] }));
  const current = items.find((i) => (i.href === "/" ? path === "/" : path === i.href || path.startsWith(i.href + "/")))?.key ?? "home";
  return <BottomNav items={items} current={current} linkAs={Link} />;
}
