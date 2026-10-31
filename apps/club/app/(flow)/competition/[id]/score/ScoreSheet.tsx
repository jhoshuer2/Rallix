"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, PlayerSlot, ScoreTile } from "@rallix/ui";
import { isValidGame, resolveMatch, type GameScore } from "@rallix/stats";
import { saveResult } from "../../../../../lib/actions";

type P = { id: string; name: string; photo: string | null; rank: number };
type Snap = { done: GameScore[]; cur: [number, number] };

export function ScoreSheet({ competitionId, matchId, bestOf, p1, p2 }: { competitionId: string; matchId: string; bestOf: number; p1: P; p2: P }) {
  const router = useRouter();
  const [s, setS] = useState<Snap>({ done: [], cur: [0, 0] });
  const [history, setHistory] = useState<Snap[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const outcome = resolveMatch(s.done, bestOf);
  const finished = outcome.valid;

  function point(who: 0 | 1) {
    if (finished) return;
    const cur: [number, number] = [...s.cur];
    cur[who] += 1;
    const game = { p1: cur[0], p2: cur[1] };
    setHistory([...history, s]);
    setS(isValidGame(game) ? { done: [...s.done, game], cur: [0, 0] } : { done: s.done, cur });
  }
  function undo() { const prev = history[history.length - 1]; if (prev) { setS(prev); setHistory(history.slice(0, -1)); } }
  async function save() {
    setSaving(true); setError(undefined);
    const r = await saveResult({ matchId, games: s.done });
    if (!r.ok) { setSaving(false); return setError(r.error); }
    router.push(`/competition/${competitionId}/groups`);
    router.refresh();
  }
  const wins = [s.done.filter((g) => g.p1 > g.p2).length, s.done.filter((g) => g.p2 > g.p1).length];
  const winner = outcome.valid ? (outcome.winnerSide === 1 ? p1 : p2) : null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="rx-scorebar">
        <span>Games {wins[0]}–{wins[1]} · best of {bestOf}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" onClick={undo} disabled={!history.length || saving}>Undo</Button>
          <Link className="rx-btn rx-btn--surface" href={`/competition/${competitionId}/groups`}>Exit</Link>
        </span>
      </div>
      <PlayerSlot slot={{ rank: p1.rank, name: p1.name, photo: p1.photo ?? undefined, scores: s.done.map((g) => g.p1), winner: outcome.valid && outcome.winnerSide === 1 }} />
      <ScoreTile name={p1.name} score={s.cur[0]} dim={finished} onPoint={() => point(0)} />
      <ScoreTile name={p2.name} score={s.cur[1]} dim={finished} onPoint={() => point(1)} />
      <PlayerSlot slot={{ rank: p2.rank, name: p2.name, photo: p2.photo ?? undefined, scores: s.done.map((g) => g.p2), winner: outcome.valid && outcome.winnerSide === 2 }} />
      <p role="status" aria-live="polite" style={{ textAlign: "center", margin: 0 }}>{winner ? `Winner: ${winner.name}` : "Tap a number to award a point"}</p>
      {finished ? <Button block disabled={saving} onClick={save}>{saving ? "Saving…" : "Save result"}</Button> : null}
      {error ? <p className="rx-error" role="alert">{error}</p> : null}
    </div>
  );
}
