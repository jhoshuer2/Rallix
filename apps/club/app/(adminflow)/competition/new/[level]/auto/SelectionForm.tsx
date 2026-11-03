"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BackButton, CheckRow, ChoiceToggle, ListGroup, PageShell, Panel, Photo, Switch, TextField, EmptyState } from "@rallix/ui";
import { createCompetition } from "../../../../../../lib/actions";

type M = { id: string; name: string; rank: number; photo: string | null };

export function SelectionForm({ level, members }: { level: string; members: M[] }) {
  const router = useRouter();
  const manual = useSearchParams().get("manual") === "1";
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [format, setFormat] = useState<"group_stage" | "one_on_one" | "knockout">("group_stage");
  const [raffle, setRaffle] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(members.map((p) => [p.id, !manual])));
  const [openReg, setOpenReg] = useState(false);
  const [spots, setSpots] = useState("");
  const [closes, setCloses] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const ids = members.filter((m) => picked[m.id]).map((m) => m.id);
  const dateBad = !!start && !!end && end < start;
  const spotsNum = spots ? Number(spots) : null;
  const spotsBad = openReg && spotsNum !== null && (spotsNum < 2 || spotsNum > 128 || ids.length > spotsNum);
  const valid = name.trim() && start && end && !dateBad && (openReg || ids.length >= 2) && !spotsBad;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setTried(true); setError(undefined);
    if (!valid) return;
    setBusy(true);
    const r = await createCompetition({ name, level: level === "combined" ? null : (level as "junior" | "intermediate" | "senior"), format, drawMethod: format === "knockout" && raffle ? "raffle" : "seeded", startsOn: start, endsOn: end, memberIds: ids, openRegistration: openReg, maxPlayers: openReg ? spotsNum : null, closesOn: openReg && closes ? closes : null });
    if (!r.ok) { setBusy(false); return setError(r.error); }
    router.push(r.draft ? `/competition/${r.id}/groups` : `/competition/${r.id}/shuffle`);
  }

  return (
    <PageShell back={<BackButton href={`/competition/new/${level}`} linkAs={Link} />} title={manual ? "Manual selection" : "Automatic selection"}>
      <form noValidate onSubmit={submit}>
        <Panel>
          <TextField label="What will you name this competition?" icon="search" placeholder="E.g. Paris Arena Open" value={name} onChange={(e) => setName(e.target.value)} error={tried && !name.trim() ? "Give the competition a name" : undefined} />
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="rx-legend">Date of competition</legend>
            <div className="rx-fieldpair">
              <TextField label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} error={tried && !start ? "Pick a start date" : undefined} />
              <TextField label="End date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={dateBad ? "End must be after start" : tried && !end ? "Pick an end date" : undefined} />
            </div>
          </fieldset>
          <ChoiceToggle label="What format will the competition be in?" value={format} onChange={setFormat}
            options={[{ value: "group_stage", label: "Group Stage", icon: "grid" }, { value: "one_on_one", label: "One on One", icon: "members" }, { value: "knockout", label: "Knockout", icon: "trophy" }]} />
          {format === "knockout" ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div><strong style={{ display: "block", fontWeight: 600 }}>Draw by raffle</strong><span className="rx-muted" style={{ fontSize: 13 }}>Off: the best-rated players are kept apart. On: a random draw when it starts.</span></div>
              <Switch label="Draw by raffle" checked={raffle} onChange={setRaffle} />
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div><strong style={{ display: "block", fontWeight: 600 }}>Players can join themselves</strong><span className="rx-muted" style={{ fontSize: 13 }}>Open sign-up. You start the competition when you are ready.</span></div>
            <Switch label="Players can join themselves" checked={openReg} onChange={(v) => { setOpenReg(v); if (!manual) setPicked(Object.fromEntries(members.map((p) => [p.id, !v]))); }} />
          </div>
          {openReg ? (
            <div className="rx-fieldpair rx-fieldpair--single" style={{ marginTop: 16 }}>
              <TextField label="Spot limit (optional)" inputMode="numeric" placeholder="E.g. 16" value={spots} onChange={(e) => setSpots(e.target.value.replace(/\D/g, ""))} error={spotsBad ? "2 to 128, and not fewer than the players picked" : undefined} />
              <TextField label="Sign-up closes (optional)" type="date" value={closes} onChange={(e) => setCloses(e.target.value)} />
            </div>
          ) : null}
        </Panel>
        <h2 className="rx-panel__title" style={{ margin: "32px 0 0" }}>{openReg ? `Players already in (${ids.length})` : `Players (${ids.length})`}</h2>
        {members.length === 0 ? <EmptyState compact title="No players at this level yet" hint="Share your invite link, or pick “Combine levels”." /> : (
          <ListGroup label="Players participating in the competition">
            {members.map((p) => <CheckRow key={p.id} media={<Photo src={p.photo} name={p.name} alt="" />} title={p.name} subtitle={`Rank ${p.rank}`} checked={!!picked[p.id]} onChange={(v) => setPicked({ ...picked, [p.id]: v })} />)}
          </ListGroup>
        )}
        {tried && !openReg && ids.length < 2 ? <p className="rx-error" role="alert">Pick at least two players</p> : null}
        {error ? <p className="rx-error" role="alert">{error}</p> : null}
        <div style={{ height: 24 }} />
        <button type="submit" disabled={busy} className="rx-btn rx-btn--block">{busy ? "Creating…" : openReg ? "Open sign-up" : `Shuffle ${format === "group_stage" ? "group" : "one-on-one"}`}</button>
      </form>
    </PageShell>
  );
}
