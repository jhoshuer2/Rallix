"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, PlayerSlot, ScoreTile } from "@rallix/ui";
import { enqueue, gamePointFor, isDeuce, isValidGame, newItem, resolveMatch, type GameScore } from "@rallix/stats";
import { announceOutbox, deleteDraft, getDraft, listOutbox, newClientRef, putOutbox, saveDraft, saveMatchContext } from "../../../../../lib/offline-store";
import { syncNow } from "../../../../../lib/offline-sync";

type P = { id: string; name: string; photo: string | null; rank: number };
/** `last`: the game that just ended, so the umpire sees it finish and the next one start. */
type Last = { n: number; p1: number; p2: number; stopped: boolean };
type Snap = { done: GameScore[]; cur: [number, number]; last: Last | null };

export function ScoreSheet({ competitionId, clubId, matchId, bestOf, p1, p2 }: { competitionId: string; clubId: string; matchId: string; bestOf: number; p1: P; p2: P }) {
  const router = useRouter();
  const [s, setS] = useState<Snap>({ done: [], cur: [0, 0], last: null });
  const [history, setHistory] = useState<Snap[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string>();
  const [queued, setQueued] = useState(false);

  // Keep what this phone needs to score this match with no signal: the names and the half-played score.
  useEffect(() => {
    void saveMatchContext({ matchId, competitionId, clubId, bestOf, savedAt: Date.now(), p1, p2 });
    void getDraft(matchId).then((d) => { if (d && (d.done.length || d.cur[0] || d.cur[1])) setS({ done: d.done, cur: d.cur, last: null }); });
    // Warm the offline copy of the scoring screen while there is a signal.
    try { navigator.serviceWorker?.controller?.postMessage({ type: "prepare-offline" }); } catch { /* ignore */ }
    
  }, []);
  useEffect(() => { if (!queued && (s.done.length || s.cur[0] || s.cur[1])) void saveDraft({ matchId, done: s.done, cur: s.cur, savedAt: Date.now() }); }, [s, matchId, queued]);
  const outcome = resolveMatch(s.done, bestOf);
  const finished = outcome.valid;
  const players = [p1, p2];
  const gameNo = finished ? s.done.length : s.done.length + 1;

  const push = (next: Snap) => { setHistory([...history, s]); setS(next); setConfirmEnd(false); };

  function point(who: 0 | 1) {
    if (finished) return;
    const cur: [number, number] = [...s.cur];
    cur[who] += 1;
    const game = { p1: cur[0], p2: cur[1] };
    // A game ends by itself at 11 (or by two clear points after 10-10). The next one starts at 0-0 straight away.
    if (isValidGame(game)) push({ done: [...s.done, game], cur: [0, 0], last: { n: s.done.length + 1, p1: game.p1, p2: game.p2, stopped: false } });
    else push({ done: s.done, cur, last: null });
  }
  /** The umpire ends the game now. Whoever is ahead wins it; the score is kept as it stood. */
  function endGame() {
    if (finished || s.cur[0] === s.cur[1]) return;
    const game: GameScore = { p1: s.cur[0], p2: s.cur[1], stopped: true };
    push({ done: [...s.done, game], cur: [0, 0], last: { n: s.done.length + 1, p1: game.p1, p2: game.p2, stopped: true } });
  }
  function undo() { const prev = history[history.length - 1]; if (prev) { setS(prev); setHistory(history.slice(0, -1)); setConfirmEnd(false); } }
  /** The result is always put in the phone's outbox first, then sent. Online it goes at once; offline it waits, and nothing is lost. */
  async function save() {
    setSaving(true); setError(undefined);
    const clientRef = newClientRef();
    const label = `${p1.name} v ${p2.name}`;
    const queue = await listOutbox();
    const q = enqueue(queue, newItem({ clientRef, matchId, competitionId, clubId, label, games: s.done }, Date.now()));
    if (q === queue) { setSaving(false); return setError("This result is already waiting to send."); }
    const item = q[q.length - 1]!;
    await putOutbox(item);
    await deleteDraft(matchId);
    announceOutbox();
    await syncNow({ force: true });
    const after = (await listOutbox()).find((i) => i.clientRef === clientRef);
    if (!after || after.state === "synced") { router.push(`/competition/${competitionId}/groups`); router.refresh(); return; }
    setSaving(false);
    if (after.state === "waiting" || after.state === "syncing") { setQueued(true); return; }
    setError(after.message ?? "Could not save the result.");
  }
  const wins = [s.done.filter((g) => g.p1 > g.p2).length, s.done.filter((g) => g.p2 > g.p1).length];
  const winner = outcome.valid ? (outcome.winnerSide === 1 ? p1 : p2) : null;
  const gp = gamePointFor(s.cur[0], s.cur[1]);
  const leader = s.cur[0] === s.cur[1] ? null : s.cur[0] > s.cur[1] ? 0 : 1;
  const lastWinner = s.last ? players[s.last.p1 > s.last.p2 ? 0 : 1]! : null;
  const status = winner ? `Winner: ${winner.name}`
    : s.last && lastWinner ? `Game ${s.last.n} ${s.last.stopped ? "stopped" : "finished"}: ${lastWinner.name} wins ${Math.max(s.last.p1, s.last.p2)}–${Math.min(s.last.p1, s.last.p2)}${s.last.stopped ? " (ended by the umpire)" : ""}. Game ${gameNo} starts at 0–0.`
    : isDeuce(s.cur[0], s.cur[1]) && gp === null ? "Deuce: first to lead by two wins the game"
    : gp !== null ? `Game point: ${players[gp]!.name}${isDeuce(s.cur[0], s.cur[1]) ? " (deuce: a lead of two wins)" : ""}`
    : "Tap a number to award a point";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="rx-scorebar">
        <span><strong>{finished ? "Match finished" : `Game ${gameNo} of ${bestOf}`}</strong> · Games {wins[0]}–{wins[1]}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" onClick={undo} disabled={!history.length || saving}>Undo</Button>
          <Link className="rx-btn rx-btn--surface" href={`/competition/${competitionId}/groups`}>Exit</Link>
        </span>
      </div>
      <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "#c8ccd6" }}>First to 11, win by 2 · best of {bestOf}</p>
      <PlayerSlot slot={{ rank: p1.rank, name: p1.name, photo: p1.photo ?? undefined, scores: s.done.map((g) => g.p1), winner: outcome.valid && outcome.winnerSide === 1 }} />
      <ScoreTile name={p1.name} score={s.cur[0]} dim={finished} onPoint={() => point(0)} />
      <ScoreTile name={p2.name} score={s.cur[1]} dim={finished} onPoint={() => point(1)} />
      <PlayerSlot slot={{ rank: p2.rank, name: p2.name, photo: p2.photo ?? undefined, scores: s.done.map((g) => g.p2), winner: outcome.valid && outcome.winnerSide === 2 }} />
      <p role="status" aria-live="polite" style={{ textAlign: "center", margin: 0 }}>{status}</p>
      {!finished && leader !== null ? (
        confirmEnd ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p role="alert" style={{ margin: 0, textAlign: "center" }}>End game {gameNo} at {s.cur[0]}–{s.cur[1]}? {players[leader]!.name} wins this game.</p>
            <div className="rx-fieldpair">
              <Button onClick={endGame}>End game {gameNo}</Button>
              <Button variant="ghost" onClick={() => setConfirmEnd(false)}>Keep playing</Button>
            </div>
          </div>
        ) : <Button variant="ghost" block onClick={() => setConfirmEnd(true)}>End game {gameNo}</Button>
      ) : null}
      {finished && !queued ? <Button block disabled={saving} onClick={save}>{saving ? "Saving…" : "Save result"}</Button> : null}
      {queued ? (
        <div role="status" style={{ display: "grid", gap: 8, textAlign: "center" }}>
          <p style={{ margin: 0 }}><strong>Saved on this phone.</strong> It will be sent when you have a signal.</p>
          <Link className="rx-btn rx-btn--surface" href={`/competition/${competitionId}/groups`}>Back to matches</Link>
        </div>
      ) : null}
      {error ? <p className="rx-error" role="alert">{error}</p> : null}
    </div>
  );
}
