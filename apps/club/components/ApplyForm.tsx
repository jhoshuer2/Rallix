"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ChoiceToggle, Panel, TextField } from "@rallix/ui";
import { applyToClub, withdrawApplication } from "../lib/application-actions";

type Level = "junior" | "intermediate" | "senior";

/** The form at the bottom of a club's invite page: apply (review clubs) or join (open clubs). */
export function ApplyForm({ code, defaultName, open }: { code: string; defaultName: string; open: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<Level | undefined>(undefined);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const ready = name.trim().length >= 2 && !!level;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setTried(true); setError(undefined);
    if (!ready) return;
    setBusy(true);
    const r = await applyToClub({ code, yourName: name, level: level!, phone, message });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    if (r.outcome === "joined" || r.outcome === "member") { router.push("/play"); router.refresh(); return; }
    router.refresh();
  }
  return (
    <Panel title={open ? "Join this club" : "Apply to join"}>
      <form noValidate onSubmit={submit} id="apply">
        <TextField label="Your full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={tried && name.trim().length < 2 ? "Enter your name" : undefined} />
        <ChoiceToggle label="Your level" value={level} onChange={setLevel} options={[{ value: "junior", label: "Junior" }, { value: "intermediate", label: "Intermediate" }, { value: "senior", label: "Senior" }]} />
        {tried && !level ? <p className="rx-error" role="alert" style={{ marginTop: -16, marginBottom: 16 }}>Choose your level</p> : null}
        <TextField label="Phone or WhatsApp (optional)" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {!open ? <TextField label="A short message to the club (optional)" placeholder="E.g. I played at university and want to join Saturday games." maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} /> : null}
        {error ? <p className="rx-error" role="alert">{error}</p> : null}
        <Button type="submit" block disabled={busy}>{busy ? "Please wait…" : open ? "Join club" : "Send application"}</Button>
        {!open ? <p className="rx-muted" style={{ margin: "12px 0 0", fontSize: 13 }}>The club's admins will review your application. You will get an email when they decide.</p> : null}
      </form>
    </Panel>
  );
}

/** Shown after applying: the application is with the club. The applicant may take it back. */
export function ApplicationSent({ id, clubName }: { id: string; clubName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  return (
    <Panel title="Application sent">
      <p style={{ margin: "0 0 12px" }}>{clubName} will review your application. You will get an email when they decide.</p>
      <Button variant="ghost" block disabled={busy} onClick={async () => { setBusy(true); const r = await withdrawApplication(id); setBusy(false); if (!r.ok) setMsg(r.error); else router.refresh(); }}>Withdraw application</Button>
      {msg ? <p role="alert" className="rx-error">{msg}</p> : null}
    </Panel>
  );
}
