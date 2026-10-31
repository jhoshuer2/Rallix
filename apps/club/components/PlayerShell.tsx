"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav, playerNav } from "@rallix/ui";

export function PlayerNav() {
  const path = usePathname();
  const items = playerNav();
  const current = items.find((i) => (i.href === "/play" ? path === "/play" : path.startsWith(i.href)))?.key ?? "home";
  return <BottomNav items={items} current={current} linkAs={Link} label="Player" />;
}
