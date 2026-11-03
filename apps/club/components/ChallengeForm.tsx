"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Segmented, Switch, TextField } from "@rallix/ui";
import { challengePlayer } from "../lib/friendly-actions";

/** One short form: when (optional), how long, whether it counts, and a line to say. */
export function ChallengeForm({ opponentId, opponentName }: { opponentId: string; opponentName: string }) {
  const router = useRouter();
  const [when, setWhen] = useState("");
  const [best, setBest] = useState<"1" | "3" | "5">("3");
  const [rated, setRated] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  return (
    <form noValidate onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(undefined);
      const r = await challengePlayer({ opponentId, when: when ? new Date(when).toISOString() : null, message, bestOf: Number(best), rated });
      if (r.ok) router.replace("/play/friendlies"); else { setErr(r.error); setBusy(false); }
    }}>
      <TextField label="When (optional)" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      <p className="rx-label" style={{ margin: "16px 0 8px" }}>Match length</p>
      <Segmented label="Match length" value={best} onChange={setBest} options={[{ value: "1", label: "1 game" }, { value: "3", label: "Best of 3" }, { value: "5", label: "Best of 5" }]} />
      <div style={{ height: 16 }} />
      <Switch label="Count it for the ranking" checked={rated} onChange={setRated} />
      <p className="rx-muted" style={{ margin: "4px 0 16px" }}>It only counts if {(opponentName.split(/\s+/)[0] ?? opponentName)} agrees too.</p>
      <TextField label="Message (optional)" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Fancy a game after work?" />
      {err ? <p role="alert" className="rx-error">{err}</p> : null}
      <Button type="submit" block disabled={busy}>{busy ? "Sending…" : `Challenge ${(opponentName.split(/\s+/)[0] ?? opponentName)}`}</Button>
    </form>
  );
}
