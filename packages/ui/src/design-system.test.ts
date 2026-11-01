import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Relative luminance and WCAG contrast ratio for #rrggbb colours. */
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x! + 0.05) / (y! + 0.05); };
const css = readFileSync(join(__dirname, "tokens.css"), "utf8");
const token = (name: string) => { const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)); if (!m) throw new Error(`token ${name} not found`); return m[1]!; };

describe("colour contrast (WCAG AA)", () => {
  const pairs: Array<[string, string, string, number]> = [
    ["ink on canvas", "rx-ink", "rx-canvas", 4.5], ["ink on white surface", "rx-ink", "rx-surface", 4.5],
    ["secondary text on white", "rx-ink-3", "rx-surface", 4.5], ["secondary text on canvas", "rx-ink-3", "rx-canvas", 4.5],
    ["white on blue band", "rx-white", "rx-blue", 4.5], ["white on rust button", "rx-white", "rx-rust", 4.5],
    ["white on night", "rx-white", "rx-night", 4.5], ["yellow on night (hero numbers)", "rx-yellow", "rx-night", 4.5],
    ["white on green pill", "rx-white", "rx-green", 4.5],
  ];
  for (const [name, fg, bg, min] of pairs) it(`${name} is at least ${min}:1`, () => { expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(min); });
});

/** Converted screens must use the card family, not legacy components or raw card classes. */
const ROOT = join(__dirname, "../../../apps/club/app");
const CONVERTED = ["(admin)", "(player)", "(playerflow)"];
const LEGACY = ["Card", "Chip", "FormatCard", "PromoCard", "PaymentRow", "PlayerRow", "RankRow", "RankCard", "DueCard", "MatchCard", "StatGrid", "ClubRow", "PageHead", "SectionHeader"];
const RAW = ["rx-card", "rx-promo", "rx-format", "rx-rank", "rx-stats", "rx-match", "rx-pays"];
function files(dir: string): string[] { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : []; }); }
describe("converted screens follow the design system", () => {
  for (const group of CONVERTED) {
    for (const f of files(join(ROOT, group))) {
      it(`${group}/${f.split(group)[1]} uses no legacy cards`, () => {
        const src = readFileSync(f, "utf8");
        const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@rallix\/ui"/g)].flatMap((m) => m[1]!.split(",").map((x) => x.trim().split(/\s+as\s+/)[0]!));
        expect(imports.filter((n) => LEGACY.includes(n))).toEqual([]);
        for (const c of RAW) expect(src.includes(`"${c}"`) || src.includes(`"${c} `) || src.includes(` ${c}"`) || src.includes(`className="${c}`)).toBe(false);
      });
    }
  }
});
