"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, StickyBar } from "@rallix/ui";
import { ordinal, type RegistrationState } from "@rallix/stats";
import { joinCompetition, joinWaitlist, leaveCompetition, leaveWaitlist } from "../lib/competition-actions";

/**
 * The ONE main action of a competition preview, fixed at the bottom with a short line beside it ("3 spots left").
 * Join, Join waitlist, "You're 2nd in line", or Registered; plus a quiet Leave while it is a draft.
 */
export function CompetitionJoin({ id, state, canLeave, level, spots, position }: { id: string; state: Exclude<RegistrationState, "hidden">; canLeave: boolean; level: string | null; spots: string | null; position: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setMsg(undefined);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setMsg(r.error); else router.refresh();
  }
  const headline = state === "registered" ? "You’re in" : state === "waiting" ? (position ? `You’re ${ordinal(position)} in line` : "You’re on the waitlist") : state === "waitlist" ? "Full" : state === "closed" ? "Sign-up closed" : state === "wrong_level" ? "Not open to you" : "Open for sign-up";
  const quiet = state === "registered" && canLeave ? { label: "Leave competition", fn: () => leaveCompetition(id) } : state === "waiting" ? { label: "Leave waitlist", fn: () => leaveWaitlist(id) } : null;
  return (
    <StickyBar label="Join this competition">
      <div className="rx-stickybar__info">
        <strong>{headline}</strong>
        {msg ? <span role="alert" className="rx-error" style={{ margin: 0 }}>{msg}</span> : spots ? <span className="rx-muted" style={{ margin: 0 }}>{spots}</span> : null}
        {quiet ? <button type="button" className="rx-linkbtn" disabled={busy} onClick={() => run(quiet.fn)} style={{ justifySelf: "start" }}>{quiet.label}</button> : null}
      </div>
      <div className="rx-stickybar__main">
        {state === "join" ? <Button block disabled={busy} onClick={() => run(() => joinCompetition(id))}>{busy ? "Joining…" : "Join"}</Button> : null}
        {state === "waitlist" ? <Button block disabled={busy} onClick={() => run(() => joinWaitlist(id))}>{busy ? "Joining…" : "Join waitlist"}</Button> : null}
        {state === "registered" ? <div role="status" className="rx-btn rx-btn--block rx-btn--ghost" aria-disabled="true" style={{ boxSizing: "border-box", pointerEvents: "none" }}>Registered ✓</div> : null}
        {state === "waiting" ? <div role="status" className="rx-btn rx-btn--block rx-btn--ghost" aria-disabled="true" style={{ boxSizing: "border-box", pointerEvents: "none" }}>On the waitlist</div> : null}
        {state === "wrong_level" ? <Button block disabled variant="ghost">{level ? `${level} only` : "Not open"}</Button> : null}
        {state === "closed" ? <Button block disabled variant="ghost">Closed</Button> : null}
      </div>
    </StickyBar>
  );
}
