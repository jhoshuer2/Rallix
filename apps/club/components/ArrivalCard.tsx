"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, ListGroup, ListRow, Photo, SectionTitle, useToast } from "@rallix/ui";
import { checkIn, checkOut } from "../lib/arrival-actions";
import { getFix, locationGranted } from "../lib/client-geo";

export type HereItem = { id: string; name: string; photo: string | null; since: string };
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
const GUARD = "rallix:arrival-try";

/** "At the court": who is here and one button. Shown only when the club has set its court location. */
export function ArrivalCard({ venueLabel, here, iAmHere, share, auto, today }: { venueLabel: string | null; here: HereItem[]; iAmHere: boolean; share: boolean; auto: boolean; /** Today's session, when the club has one: "Tuesday night · Doors open 17:45". */ today?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Automatic check-in only while the app is open, only if location is already allowed, and at most once every 20 minutes.
  useEffect(() => {
    if (!auto || !share || iAmHere) return;
    let live = true;
    async function tryAuto() {
      if (document.visibilityState !== "visible") return;
      try { const last = Number(sessionStorage.getItem(GUARD) ?? 0); if (Date.now() - last < 20 * 60_000) return; sessionStorage.setItem(GUARD, String(Date.now())); } catch { /* ignore */ }
      if (!(await locationGranted())) return;
      try { const f = await getFix(); const r = await checkIn({ ...f, method: "auto" }); if (live && r.ok) router.refresh(); } catch { /* silent: automatic mode never nags */ }
    }
    tryAuto();
    document.addEventListener("visibilitychange", tryAuto);
    return () => { live = false; document.removeEventListener("visibilitychange", tryAuto); };
  }, [auto, share, iAmHere, router]);

  async function arrive() {
    setBusy(true);
    try {
      const f = await getFix();
      const r = await checkIn({ ...f, method: "manual" });
      if (!r.ok) toast.error(r.error); else { toast.success("You’re checked in. Others who asked to be told have been alerted."); router.refresh(); }
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  async function leave() { setBusy(true); const r = await checkOut(); if (!r.ok) toast.error(r.error); else { toast.success("You’ve left. See you next time."); router.refresh(); } setBusy(false); }

  return (
    <>
      <SectionTitle title="At the court" />
      {today ? <p className="rx-muted" style={{ margin: "0 0 8px" }}>Today: {today}</p> : null}
      {here.length ? (
        <ListGroup label="Here now">
          {here.slice(0, 5).map((h) => <ListRow key={h.id} media={<Photo src={h.photo} name={h.name} alt="" />} title={h.name} subtitle={`Here since ${time(h.since)}`} />)}
        </ListGroup>
      ) : <p className="rx-muted" style={{ margin: "8px 0 0" }}>{venueLabel ? `No one has checked in at ${venueLabel} yet.` : "No one has checked in yet."}</p>}
      <div style={{ marginTop: 12 }}>
        {share ? (
          iAmHere ? <Button variant="ghost" block disabled={busy} onClick={leave}>{busy ? "Please wait…" : "I’ve left"}</Button>
            : <Button block disabled={busy} onClick={arrive}>{busy ? "Finding you…" : "I’ve arrived"}</Button>
        ) : <p className="rx-muted" style={{ margin: 0 }}>To check in, turn on “Share when I arrive” on your <Link href="/play/me" style={{ textDecoration: "underline" }}>Me page</Link>.</p>}
      </div>
    </>
  );
}
