"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ChoiceToggle, EntryShell, Pill, TextField } from "@rallix/ui";
import { joinClub } from "../../../../lib/actions";

export function JoinForm({ code, defaultName }: { code: string; defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState<"junior" | "intermediate" | "senior" | undefined>(undefined);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const ok = name.trim().length >= 2 && level;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setTried(true); setError(undefined);
    if (!ok) return;
    setBusy(true);
    const r = await joinClub({ code, yourName: name, level: level!, phone });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    router.push("/play");
    router.refresh();
  }
  return (
    <EntryShell title="Join your club" subtitle="Finish your player profile to see your competitions, stats and ranking." hero={<p style={{ margin: "16px 0 0" }}><Pill>Invite {code}</Pill></p>}>
      <form noValidate onSubmit={submit}>
        <TextField label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={tried && name.trim().length < 2 ? "Enter your name" : undefined} />
        <TextField label="Phone or WhatsApp (optional)" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <ChoiceToggle label="Your level" value={level} onChange={setLevel} options={[{ value: "junior", label: "Junior" }, { value: "intermediate", label: "Intermediate" }, { value: "senior", label: "Senior" }]} />
        {tried && !level ? <p className="rx-error" role="alert" style={{ marginTop: -16, marginBottom: 16 }}>Choose your level</p> : null}
        {error ? <p className="rx-error" role="alert">{error}</p> : null}
        <Button type="submit" block disabled={busy}>{busy ? "Joining…" : "Join club"}</Button>
      </form>
    </EntryShell>
  );
}
