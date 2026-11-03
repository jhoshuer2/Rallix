/** Pure league-table rules: points for wins and losses, tie-breaks, and season totals. */

export interface StandingMatch {
  /** Groups matches into separate tables (for example "Group A"). */
  table?: string;
  p1: string | null; p2: string | null;
  winner: string | null;
  /** Games won by each side. */
  g1: number; g2: number;
  /** Rally points by each side, summed over the games, when known. */
  pts1?: number; pts2?: number;
  /** Only decided matches count. */
  done: boolean;
}
export interface PointsRules { win: number; loss: number }
export const DEFAULT_RULES: PointsRules = { win: 3, loss: 0 };

export interface StandingRow {
  id: string; played: number; won: number; lost: number; points: number;
  gamesFor: number; gamesAgainst: number; gameDiff: number; pointDiff: number; rank: number;
}

/** A league table. Ranked by points, then head-to-head between the tied pair, then game difference, then point difference, then id (stable). */
export function standings(matches: StandingMatch[], rules: PointsRules = DEFAULT_RULES, players: string[] = []): StandingRow[] {
  const by = new Map<string, StandingRow>();
  const row = (id: string): StandingRow => {
    let r = by.get(id);
    if (!r) { r = { id, played: 0, won: 0, lost: 0, points: 0, gamesFor: 0, gamesAgainst: 0, gameDiff: 0, pointDiff: 0, rank: 0 }; by.set(id, r); }
    return r;
  };
  for (const p of players) row(p);
  const h2h = new Map<string, number>(); // "a>b" = how many times a beat b
  for (const m of matches) {
    if (!m.done || !m.p1 || !m.p2 || !m.winner) continue;
    const a = row(m.p1), b = row(m.p2);
    a.played++; b.played++;
    a.gamesFor += m.g1; a.gamesAgainst += m.g2; b.gamesFor += m.g2; b.gamesAgainst += m.g1;
    const d = (m.pts1 ?? 0) - (m.pts2 ?? 0);
    a.pointDiff += d; b.pointDiff -= d;
    const [w, l] = m.winner === m.p1 ? [a, b] : [b, a];
    w.won++; l.lost++; w.points += rules.win; l.points += rules.loss;
    h2h.set(`${w.id}>${l.id}`, (h2h.get(`${w.id}>${l.id}`) ?? 0) + 1);
  }
  const rows = [...by.values()];
  for (const r of rows) r.gameDiff = r.gamesFor - r.gamesAgainst;
  rows.sort((x, y) => y.points - x.points
    || ((h2h.get(`${y.id}>${x.id}`) ?? 0) - (h2h.get(`${x.id}>${y.id}`) ?? 0)) // whoever beat the other more often goes first
    || y.gameDiff - x.gameDiff || y.pointDiff - x.pointDiff || x.id.localeCompare(y.id));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/** One table per group label, in order of first appearance. */
export function standingsByTable(matches: StandingMatch[], rules: PointsRules = DEFAULT_RULES): Array<{ table: string; rows: StandingRow[] }> {
  const names = [...new Set(matches.map((m) => m.table ?? ""))];
  return names.map((t) => ({ table: t, rows: standings(matches.filter((m) => (m.table ?? "") === t), rules) }));
}

/** A season total: every decided match in its competitions, each scored by that competition's own win/loss points. */
export function seasonTable(competitions: Array<{ rules: PointsRules; matches: StandingMatch[] }>): StandingRow[] {
  const total = new Map<string, StandingRow>();
  for (const c of competitions) {
    for (const r of standings(c.matches, c.rules)) {
      const t = total.get(r.id) ?? { ...r, played: 0, won: 0, lost: 0, points: 0, gamesFor: 0, gamesAgainst: 0, gameDiff: 0, pointDiff: 0 };
      t.played += r.played; t.won += r.won; t.lost += r.lost; t.points += r.points;
      t.gamesFor += r.gamesFor; t.gamesAgainst += r.gamesAgainst; t.gameDiff += r.gameDiff; t.pointDiff += r.pointDiff;
      total.set(r.id, t);
    }
  }
  const rows = [...total.values()].sort((x, y) => y.points - x.points || y.won - x.won || y.gameDiff - x.gameDiff || x.id.localeCompare(y.id));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export type Place = 1 | 2 | 3;
export interface Award { id: string; place: Place }

/** Awards for a finished league: the top three of the table (only players who played). */
export function awardsFromTable(rows: StandingRow[]): Award[] {
  return rows.filter((r) => r.played > 0).slice(0, 3).map((r, i) => ({ id: r.id, place: (i + 1) as Place }));
}

/** Awards for a finished knockout: champion, runner-up, and both losing semi-finalists share third. */
export function awardsFromKnockout(m: Array<{ round: number; winner: string | null; p1: string | null; p2: string | null; bye?: boolean }>): Award[] {
  const last = Math.max(...m.map((x) => x.round));
  const final = m.find((x) => x.round === last);
  if (!final || !final.winner || !final.p1 || !final.p2) return [];
  const out: Award[] = [{ id: final.winner, place: 1 }, { id: final.winner === final.p1 ? final.p2 : final.p1, place: 2 }];
  for (const s of m.filter((x) => x.round === last - 1 && !x.bye && x.winner && x.p1 && x.p2)) out.push({ id: s.winner === s.p1 ? s.p2! : s.p1!, place: 3 });
  return out;
}

export const PLACE_LABEL: Record<Place, string> = { 1: "Champion", 2: "Runner-up", 3: "Third place" };
