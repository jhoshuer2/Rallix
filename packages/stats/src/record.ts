export type GameScore = { p1: number; p2: number };
export type PlayedMatch = {
  id: string;
  player1Id: string;
  player2Id: string;
  winnerId: string;
  playedAt: Date;
  games: GameScore[];
};

export type PlayerRecord = {
  played: number; won: number; lost: number; winPct: number;
  /** Current run: positive = consecutive wins, negative = consecutive losses. */
  streak: number;
  /** Newest first, at most 5. */
  form: Array<"W" | "L">;
  gamesFor: number; gamesAgainst: number; pointsFor: number; pointsAgainst: number;
};

const side = (m: PlayedMatch, id: string) => (m.player1Id === id ? 1 : 2) as 1 | 2;

/** Stats for one player from confirmed matches only. Callers must not pass unconfirmed results. */
export function computeRecord(playerId: string, matches: PlayedMatch[]): PlayerRecord {
  const mine = matches.filter((m) => m.player1Id === playerId || m.player2Id === playerId)
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  let won = 0, gamesFor = 0, gamesAgainst = 0, pointsFor = 0, pointsAgainst = 0;
  for (const m of mine) {
    const s = side(m, playerId);
    if (m.winnerId === playerId) won++;
    for (const g of m.games) {
      const f = s === 1 ? g.p1 : g.p2, a = s === 1 ? g.p2 : g.p1;
      pointsFor += f; pointsAgainst += a;
      if (f > a) gamesFor++; else if (a > f) gamesAgainst++;
    }
  }
  const results = mine.map((m) => (m.winnerId === playerId ? "W" : "L") as "W" | "L");
  let streak = 0;
  if (results.length) {
    const first = results[0]!;
    for (const r of results) { if (r !== first) break; streak += first === "W" ? 1 : -1; }
  }
  return {
    played: mine.length, won, lost: mine.length - won,
    winPct: mine.length ? Math.round((won / mine.length) * 100) : 0,
    streak, form: results.slice(0, 5),
    gamesFor, gamesAgainst, pointsFor, pointsAgainst,
  };
}

export type HeadToHead = { opponentId: string; won: number; lost: number };

export function headToHead(playerId: string, matches: PlayedMatch[]): HeadToHead[] {
  const map = new Map<string, HeadToHead>();
  for (const m of matches) {
    if (m.player1Id !== playerId && m.player2Id !== playerId) continue;
    const opp = m.player1Id === playerId ? m.player2Id : m.player1Id;
    const row = map.get(opp) ?? { opponentId: opp, won: 0, lost: 0 };
    if (m.winnerId === playerId) row.won++; else row.lost++;
    map.set(opp, row);
  }
  return [...map.values()].sort((a, b) => b.won + b.lost - (a.won + a.lost));
}

export const streakLabel = (n: number) => (n === 0 ? "None" : n > 0 ? `${n} win${n === 1 ? "" : "s"}` : `${-n} loss${n === -1 ? "" : "es"}`);
