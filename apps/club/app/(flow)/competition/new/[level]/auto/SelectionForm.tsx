"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BackButton, ChoiceToggle, PageHead, PlayerRow, TextField } from "@rallix/ui";
import { players } from "../../../../../../lib/mock";

export function SelectionForm({ level }: { level: string }) {
  const router = useRouter();
  const manual = useSearchParams().get("manual") === "1";
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [format, setFormat] = useState<"group" | "one">("group");
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(players.map((p) => [p.id, !manual])));
  const [tried, setTried] = useState(false);
  const count = Object.values(picked).filter(Boolean).length;
  const dateBad = start && end && end < start;
  const valid = name.trim() && start && end && !dateBad && count >= 2;

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); setTried(true); if (valid) router.push("/competition/demo/shuffle"); }}>
      <PageHead back={<BackButton href={`/competition/new/${level}`} linkAs={Link} />} title={manual ? "Manual player selection" : "Automatic player selection"} />
      <TextField label="What will you name this competition?" icon="search" placeholder="E.g. Paris Arena" value={name} onChange={(e) => setName(e.target.value)} error={tried && !name.trim() ? "Give the competition a name" : undefined} />
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-label">Date of Competition</legend>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} error={tried && !start ? "Pick a start date" : undefined} />
          <TextField label="End date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={dateBad ? "End must be after start" : tried && !end ? "Pick an end date" : undefined} />
        </div>
      </fieldset>
      <ChoiceToggle label="What format will the competition be in?" value={format} onChange={setFormat}
        options={[{ value: "group", label: "Group Stage", icon: "grid" }, { value: "one", label: "One on One", icon: "members" }]} />
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-label">Players participating in the competition ({count})</legend>
        {players.map((p) => (
          <PlayerRow key={p.id} rank={p.rank} name={p.name} photo={p.photo} checked={!!picked[p.id]} onChange={(v) => setPicked({ ...picked, [p.id]: v })} />
        ))}
        {tried && count < 2 ? <p className="rx-error" role="alert">Pick at least two players</p> : null}
      </fieldset>
      <div style={{ height: 16 }} />
      <button type="submit" className="rx-btn rx-btn--block">Shuffle {format === "group" ? "group" : "one-on-one"} <span className="rx-btn__ball" aria-hidden="true" /></button>
    </form>
  );
}
