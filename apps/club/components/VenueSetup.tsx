"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Segmented, TextField, useToast } from "@rallix/ui";
import { saveVenue } from "../lib/arrival-actions";
import { getFix } from "../lib/client-geo";

type V = { label: string | null; lat: number; lng: number; radiusM: number } | null;

/** Admin: stand at the court and tap once. Players are checked against this point and radius on the server. */
export function VenueSetup({ venue }: { venue: V }) {
  const router = useRouter();
  const [label, setLabel] = useState(venue?.label ?? "");
  const [radius, setRadius] = useState<"50" | "100" | "200">(String(venue?.radiusM ?? 100) as "50" | "100" | "200");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      const f = await getFix();
      if (f.accuracy > 100) { setBusy(false); return toast.error(`Your location is only accurate to ${Math.round(f.accuracy)} m. Step outside, wait a few seconds and try again.`); }
      const r = await saveVenue({ lat: f.lat, lng: f.lng, label, radiusM: Number(radius) });
      if (!r.ok) toast.error(r.error); else { toast.success("Court location saved."); router.refresh(); }
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p className="rx-muted" style={{ margin: 0 }}>{venue ? <>Court set{venue.label ? `: ${venue.label}` : ""}. <a href={`https://www.google.com/maps?q=${venue.lat},${venue.lng}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Check it on the map</a></> : "Stand at the court, then tap the button. Players can check in once they are within the radius."}</p>
      <TextField label="Court name (optional)" placeholder="E.g. Central Hall" value={label} onChange={(e) => setLabel(e.target.value)} />
      <Segmented label="Radius" value={radius} onChange={setRadius} options={[{ value: "50", label: "50 m" }, { value: "100", label: "100 m" }, { value: "200", label: "200 m" }]} />
      <Button block disabled={busy} onClick={save}>{busy ? "Finding you…" : venue ? "Update to my current location" : "Use my current location"}</Button>
    </div>
  );
}
