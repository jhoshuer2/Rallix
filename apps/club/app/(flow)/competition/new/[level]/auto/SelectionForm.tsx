"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BackButton, ChoiceToggle, PageHead, PlayerRow, TextField } from "@rallix/ui";
import { createCompetition } from "../../../../../../lib/actions";

type M = { id: string; name: string; rank: number; photo: string | null };

export function SelectionForm({ level, members }: { level: string; members: M[] }) {
  const router = useRouter();
  const manual = useSearchParams().get("manual") === "1";
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [format, setFormat] = useState<"group_stage" | "one_on_one">("group_stage");
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(members.map((p) => [p.id, !manual])));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const ids = members.filter((m) => picked[m.id]).map((m) => m.id);
  const dateBad = !!start && !!end && end < start;
  const valid = name.trim() && start && end && !dateBad && ids.length >= 2;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setTried(true); setError(undefined);
    if (!valid) return;
    setBusy(true);
    const r = await createCompetition({ name, level: level === "combined" ? null : (level as "junior" | "intermediate" | "senior"), format, startsOn: start, endsOn: end, memberIds: ids });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    router.push(`/competition/${r.id}/shuffle`);
  }

  return (
    <form noValidate onSubmit={submit}>
      <PageHead back={<BackButton href={`/competition/new/${level}`} linkAs={Link} />} title={manual ? "Manual player selection" : "Automatic player selection"} />
      <TextField label="What will you name this competition?" icon="search" placeholder="E.g. Paris Arena Open" value={name} onChange={(e) => setName(e.target.value)} error={tried && !name.trim() ? "Give the competition a name" : undefined} />
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-label">Date of Competition</legend>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} error={tried && !start ? "Pick a start date" : undefined} />
          <TextField label="End date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={dateBad ? "End must be after start" : tried && !end ? "Pick an end date" : undefined} />
        </div>
      </fieldset>
      <ChoiceToggle label="What format will the competition be in?" value={format} onChange={setFormat}
        options={[{ value: "group_stage", label: "Group Stage", icon: "grid" }, { value: "one_on_one", label: "One on One", icon: "members" }]} />
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-label">Players participating in the competition ({ids.length})</legend>
        {members.length === 0 ? <p className="rx-muted">No players at this level yet. Share your invite link, or pick “Combine levels”.</p> : null}
        {members.map((p) => <PlayerRow key={p.id} rank={p.rank} name={p.name} photo={p.photo ?? undefined} checked={!!picked[p.id]} onChange={(v) => setPicked({ ...picked, [p.id]: v })} />)}
        {tried && ids.length < 2 ? <p className="rx-error" role="alert">Pick at least two players</p> : null}
      </fieldset>
      {error ? <p className="rx-error" role="alert">{error}</p> : null}
      <div style={{ height: 16 }} />
      <button type="submit" disabled={busy} className="rx-btn rx-btn--block">{busy ? "Creating…" : `Shuffle ${format === "group_stage" ? "group" : "one-on-one"}`} <span className="rx-btn__ball" aria-hidden="true" /></button>
    </form>
  );
}
