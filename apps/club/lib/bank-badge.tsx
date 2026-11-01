import type { ReactNode } from "react";

/** Dark enough that white initials pass 4.5:1 contrast. */
const COLORS = ["#8F3A21", "#1F5F3A", "#2A4E80", "#6B3FA0", "#7A5B00", "#8A2D4F", "#1D6A72", "#4B4B4B", "#9C3D00", "#3F5F1F"];
const NOISE = new Set(["bank", "banks", "microfinance", "mfb", "limited", "ltd", "ltd.", "plc", "of", "nigeria", "nig", "the", "and", "&", "company", "international", "finance", "mortgage", "savings", "loans", "cooperative", "co-operative"]);

/** Up to two letters taken from the meaningful words of a bank name ("Guaranty Trust Bank" -> "GT"). Pure, so it is easy to test. */
export function bankInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&.-]/gu, " ").split(/\s+/).filter(Boolean);
  const key = words.filter((w) => !NOISE.has(w.toLowerCase()));
  const use = key.length ? key : words;
  if (use.length === 1) { const w = use[0]!; return (w.length <= 3 ? w : w.slice(0, 2)).toUpperCase(); }
  return (use[0]![0]! + use[1]![0]!).toUpperCase();
}

/** Stable colour per bank name, so the same bank always looks the same. */
export function bankColor(name: string): string {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length]!;
}

/** Decorative badge (the bank name is always written next to it). */
export function BankBadge({ name }: { name: string }): ReactNode {
  return <span className="rx-badge" style={{ background: bankColor(name) }} aria-hidden="true">{bankInitials(name)}</span>;
}
