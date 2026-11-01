/** Pure helpers for the premium components. No React, no I/O, so they are easy to test. */

/** Dark enough that white text on top passes 4.5:1. */
const HUES = [
  ["#8F3A21", "#B54829"], ["#1F5F3A", "#2E8B57"], ["#2A4E80", "#3B6CA7"], ["#6B3FA0", "#8E5CC4"],
  ["#7A5B00", "#B58A00"], ["#8A2D4F", "#B84A73"], ["#1D6A72", "#2A97A3"], ["#9C3D00", "#D45A0A"],
] as const;

export function hashString(s: string): number {
  let h = 2166136261;
  for (const ch of s.toLowerCase().trim()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** Same name, same colours, every time. */
export function placeholderColors(name: string): { from: string; to: string } {
  const [from, to] = HUES[hashString(name || "?") % HUES.length]!;
  return { from, to };
}

/** "Joshua Jumbo" -> "JJ", "Madonna" -> "MA", "" -> "?". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Short countdown for a hero card. Past times read as "Now". */
export function countdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "Now";
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

/** Score line like "3–1" from games won by each side. */
export function scoreLine(a: number | null | undefined, b: number | null | undefined): string {
  return a == null || b == null ? "–" : `${a}–${b}`;
}
