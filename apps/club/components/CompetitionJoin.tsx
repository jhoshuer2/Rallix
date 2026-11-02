"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@rallix/ui";
import type { RegistrationState } from "@rallix/stats";
import { joinCompetition, leaveCompetition } from "../lib/competition-actions";

/** The ONE main button of a competition preview, plus a quiet "Leave" while it is still a draft. */
export function CompetitionJoin({ id, state, canLeave, level }: { id: string; state: Exclude<RegistrationState, "hidden">; canLeave: boolean; level: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setMsg(undefined);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setMsg(r.error); else router.refresh();
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {state === "join" ? <Button block disabled={busy} onClick={() => run(() => joinCompetition(id))}>{busy ? "Joining…" : "Join competition"}</Button> : null}
      {state === "registered" ? <div role="status" className="rx-btn rx-btn--block rx-btn--ghost" aria-disabled="true" style={{ boxSizing: "border-box", pointerEvents: "none" }}>Registered ✓</div> : null}
      {state === "full" ? <Button block disabled variant="ghost">Full</Button> : null}
      {state === "wrong_level" ? <Button block disabled variant="ghost">{level ? `For ${level} players` : "Not open to you"}</Button> : null}
      {state === "closed" ? <p className="rx-muted" style={{ margin: 0, textAlign: "center" }}>Registration is closed.</p> : null}
      {state === "registered" && canLeave ? <button type="button" className="rx-linkbtn" disabled={busy} onClick={() => run(() => leaveCompetition(id))}>Leave competition</button> : null}
      {msg ? <p role="alert" className="rx-error" style={{ margin: 0 }}>{msg}</p> : null}
    </div>
  );
}
