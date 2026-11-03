"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Switch, TextField } from "@rallix/ui";
import type { NextStep } from "@rallix/stats";
import { answerChallenge, cancelChallenge, confirmChallengeResult, enterChallengeResult } from "../lib/friendly-actions";

/** The one thing you can do on a challenge right now, plus a quiet way out. */
export function FriendlyActions({ id, step, otherName, bestOf, wantsRated, enteredLine }: { id: string; step: NextStep; otherName: string; bestOf: number; wantsRated: boolean; enteredLine?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [rated, setRated] = useState(wantsRated);
  const [mine, setMine] = useState("");
  const [theirs, setTheirs] = useState("");
  const first = otherName.split(/\s+/)[0] ?? otherName;
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setErr(undefined);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setErr(r.error); else router.refresh();
  }
  const quiet = (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => <button type="button" className="rx-linkbtn" disabled={busy} onClick={() => run(fn)}>{label}</button>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {step === "answer" ? (
        <>
          <Switch label="Count it for the ranking" checked={rated} onChange={setRated} />
          <Button block disabled={busy} onClick={() => run(() => answerChallenge(id, true, rated))}>Accept</Button>
          {quiet("Decline", () => answerChallenge(id, false))}
        </>
      ) : null}
      {step === "waiting" ? <><p className="rx-muted" role="status" style={{ margin: 0 }}>Waiting for {first} to answer.</p>{quiet("Withdraw challenge", () => cancelChallenge(id))}</> : null}
      {step === "enter" ? (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void run(() => enterChallengeResult(id, Number(mine), Number(theirs))); }} style={{ display: "grid", gap: 12 }}>
          <p className="rx-label" style={{ margin: 0 }}>Games won, best of {bestOf}</p>
          <div className="rx-fieldpair">
            <TextField label="You" type="number" inputMode="numeric" min={0} max={3} value={mine} onChange={(e) => setMine(e.target.value)} />
            <TextField label={first} type="number" inputMode="numeric" min={0} max={3} value={theirs} onChange={(e) => setTheirs(e.target.value)} />
          </div>
          <Button type="submit" block disabled={busy || mine === "" || theirs === ""}>Send score to {first}</Button>
          {quiet("Call off", () => cancelChallenge(id))}
        </form>
      ) : null}
      {step === "confirm" ? (
        <>
          <p style={{ margin: 0 }}>{enteredLine}</p>
          <Switch label="Count it for the ranking" checked={rated} onChange={setRated} />
          <Button block disabled={busy} onClick={() => run(() => confirmChallengeResult(id, true, rated))}>Confirm score</Button>
          {quiet("That’s not right", () => confirmChallengeResult(id, false))}
        </>
      ) : null}
      {step === "waiting_confirm" ? <p className="rx-muted" role="status" style={{ margin: 0 }}>Waiting for {first} to confirm the score.</p> : null}
      {err ? <p role="alert" className="rx-error" style={{ margin: 0 }}>{err}</p> : null}
    </div>
  );
}
