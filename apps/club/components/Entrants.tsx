"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckRow, ListGroup, ListRow, Photo, Sheet } from "@rallix/ui";
import { addEntrants, removeEntrant, startCompetition } from "../lib/competition-actions";

type P = { id: string; name: string; photo: string | null };

/** Admin view of a competition that has not started: who is in, add or remove players, and the one Start button. */
export function Entrants({ id, entrants, others, max }: { id: string; entrants: P[]; others: P[]; max: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const chosen = Object.keys(picked).filter((k) => picked[k]);
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) {
    setBusy(true); setMsg(undefined);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    done?.(); router.refresh();
  }
  return (
    <>
      {entrants.length ? (
        <ListGroup label="Registered players">
          {entrants.map((p) => <ListRow key={p.id} media={<Photo src={p.photo} name={p.name} alt="" />} title={p.name} trailing={<button type="button" className="rx-btn rx-btn--ghost rx-btn--small" disabled={busy} onClick={() => run(() => removeEntrant(id, p.id))} aria-label={`Remove ${p.name}`}>Remove</button>} />)}
        </ListGroup>
      ) : null}
      {others.length && (max === null || entrants.length < max) ? <Button variant="ghost" block onClick={() => { setPicked({}); setAdding(true); }}>Add players</Button> : null}
      <div style={{ height: 12 }} />
      <Button block disabled={busy || entrants.length < 2} onClick={() => run(() => startCompetition(id))}>{busy ? "Please wait…" : "Start competition"}</Button>
      {entrants.length < 2 ? <p className="rx-muted" style={{ margin: "8px 0 0", textAlign: "center", fontSize: 13 }}>You need at least two players to start.</p> : null}
      {msg ? <p role="alert" className="rx-error">{msg}</p> : null}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add players">
        <ListGroup bare label="Players not yet registered">
          {others.map((p) => <CheckRow key={p.id} media={<Photo src={p.photo} name={p.name} alt="" />} title={p.name} checked={!!picked[p.id]} onChange={(v) => setPicked({ ...picked, [p.id]: v })} />)}
        </ListGroup>
        <div style={{ height: 12 }} />
        <Button block disabled={busy || chosen.length === 0} onClick={() => run(() => addEntrants(id, chosen), () => setAdding(false))}>{chosen.length ? `Add ${chosen.length}` : "Choose players"}</Button>
      </Sheet>
    </>
  );
}
