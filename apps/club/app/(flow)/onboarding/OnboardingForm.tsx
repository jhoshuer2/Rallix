"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, TextField } from "@rallix/ui";
import { createClub } from "../../../lib/actions";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [club, setClub] = useState("");
  const [name, setName] = useState(defaultName);
  const [place, setPlace] = useState("");
  const [phone, setPhone] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const valid = club.trim().length >= 2 && name.trim().length >= 2 && place.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setTried(true); setError(undefined);
    if (!valid) return;
    setBusy(true);
    const r = await createClub({ clubName: club, yourName: name, location: place, phone });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    router.push("/");
    router.refresh();
  }
  return (
    <form noValidate onSubmit={submit}>
      <h1 className="rx-title" style={{ marginBottom: 24 }}>Welcome to the app for managing your table tennis club</h1>
      <TextField label="What is your club called?" placeholder="E.g. Paris Arena" value={club} onChange={(e) => setClub(e.target.value)} error={tried && club.trim().length < 2 ? "Enter your club name" : undefined} />
      <TextField label="What’s your name" placeholder="Your full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={tried && name.trim().length < 2 ? "Enter your name" : undefined} />
      <TextField label="Where are you located" icon="pin" placeholder="E.g. Central Market, Kubwa, FCT, Abuja" value={place} onChange={(e) => setPlace(e.target.value)} error={tried && !place.trim() ? "Enter your location" : undefined} />
      <TextField label="Phone or WhatsApp (optional)" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error ? <p className="rx-error" role="alert">{error}</p> : null}
      <Button type="submit" variant="surface" block disabled={busy}>{busy ? "Creating…" : "Create my club"}</Button>
      <p className="rx-muted" style={{ marginTop: 16, fontSize: 13 }}>Joining a club instead? Open the invite link your club admin sent you.</p>
    </form>
  );
}
