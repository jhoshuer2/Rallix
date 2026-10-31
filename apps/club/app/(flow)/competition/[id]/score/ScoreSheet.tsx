"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, PlayerSlot, ScoreTile } from "@rallix/ui";
import { players } from "../../../../../lib/mock";

/** Best of 5 games to 11, win by 2. Pure rule helpers live here until packages/stats owns them. */
const gameWon = (a: number, b: number) => (a >= 11 || b >= 11) && Math.abs(a - b) >= 2;
type Game = [number, number];

export function ScoreSheet({ id }: { id: string }) {
  const [games, setGames] = useState<Game[]>([[0, 0]]);
  const [history, setHistory] = useState<Array<0 | 1>>([]);
  const p1 = players[6]!, p2 = players[4]!;
  const cur = games[games.length - 1]!;
  const wins = games.filter(([a, b]) => gameWon(a, b)).reduce((acc, [a, b]) => (a > b ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0]);
  const done = wins[0] >= 3 || wins[1] >= 3;

  function point(who: 0 | 1) {
    if (done) return;
    const next = games.map((g) => [...g] as Game);
    const last = next[next.length - 1]!;
    last[who] += 1;
    if (gameWon(last[0], last[1]) && wins[0] + wins[1] + 1 < 5 && Math.max(wins[0] + (last[0] > last[1] ? 1 : 0), wins[1] + (last[1] > last[0] ? 1 : 0)) < 3) next.push([0, 0]);
    setGames(next);
    setHistory([...history, who]);
  }
  function undo() {
    if (!history.length) return;
    const h = history.slice(0, -1);
    const rebuilt: Game[] = [[0, 0]];
    for (const who of h) {
      const g = rebuilt[rebuilt.length - 1]!; g[who] += 1;
      const w = rebuilt.filter(([a, b]) => gameWon(a, b)).reduce((acc, [a, b]) => (a > b ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0]);
      if (gameWon(g[0], g[1]) && Math.max(w[0], w[1]) < 3) rebuilt.push([0, 0]);
    }
    setGames(rebuilt); setHistory(h);
  }
  const scores = (who: 0 | 1) => games.filter(([a, b]) => gameWon(a, b)).map((g) => g[who]);
  const winner = wins[0] >= 3 ? 0 : wins[1] >= 3 ? 1 : null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="rx-scorebar">
        <span>Games {wins[0]}–{wins[1]}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" onClick={undo} disabled={!history.length}>Undo</Button>
          <Link className="rx-btn rx-btn--surface" href={`/competition/${id}/bracket`}>Exit score sheet</Link>
        </span>
      </div>
      <PlayerSlot slot={{ rank: p1.rank, name: p1.name, photo: p1.photo, scores: scores(0), winner: winner === 0 }} />
      <ScoreTile name={p1.name} score={cur[0]} dim={done} onPoint={() => point(0)} />
      <ScoreTile name={p2.name} score={cur[1]} dim={done} onPoint={() => point(1)} />
      <PlayerSlot slot={{ rank: p2.rank, name: p2.name, photo: p2.photo, scores: scores(1), winner: winner === 1 }} />
      <p role="status" aria-live="polite" style={{ textAlign: "center", margin: 0 }}>{winner !== null ? `Winner: ${winner === 0 ? p1.name : p2.name}` : "Tap a number to award a point"}</p>
    </div>
  );
}
