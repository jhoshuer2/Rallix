"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, ListGroup, ListRow, Pill, Sheet, TextField } from "@rallix/ui";
import { saveSeason } from "../../../../lib/season-actions";

type S = { id: string; name: string; startsOn: string; endsOn: string; leader: string | null };
const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function SeasonManager({ seasons, today }: { seasons: S[]; today: string }) {
  const router = useRouter();
  const [f, setF] = useState<null | { id: string | null; name: string; startsOn: string; endsOn: string }>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const close = () => { setF(null); setMsg(undefined); };
  async function save() {
    if (!f) return;
    setBusy(true); setMsg(undefined);
    const r = await saveSeason(f.id, f);
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    close(); router.refresh();
  }
  return (
    <>
      {seasons.length === 0 ? <EmptyState title="No seasons yet" hint="A season brings several competitions into one table over a few months."
        action={<Button onClick={() => setF({ id: null, name: "", startsOn: today, endsOn: "" })}>Create a season</Button>} /> : (
        <>
          <ListGroup label="Seasons">
            {seasons.map((s) => <ListRow key={s.id} title={s.name} subtitle={`${nice(s.startsOn)} – ${nice(s.endsOn)}${s.leader ? ` · Leading: ${s.leader}` : ""}`}
              trailing={s.startsOn <= today && today <= s.endsOn ? <Pill tone="success">Now</Pill> : undefined} onClick={() => setF({ id: s.id, name: s.name, startsOn: s.startsOn, endsOn: s.endsOn })} />)}
          </ListGroup>
          <div style={{ marginTop: 16 }}><Button block onClick={() => setF({ id: null, name: "", startsOn: today, endsOn: "" })}>Create a season</Button></div>
          <p className="rx-muted" style={{ marginTop: 12 }}>To add a competition to a season, open the competition and choose Edit details.</p>
        </>
      )}
      <Sheet open={f !== null} onClose={close} title={f?.id ? "Edit season" : "Create a season"}>
        {f ? (
          <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} style={{ display: "grid", gap: 12 }}>
            <TextField label="Name" maxLength={60} placeholder="2026/27 Season" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <div className="rx-fieldpair">
              <TextField label="Starts" type="date" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} />
              <TextField label="Ends" type="date" min={f.startsOn} value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} />
            </div>
            {msg ? <p role="alert" className="rx-error" style={{ margin: 0 }}>{msg}</p> : null}
            <Button type="submit" block disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </form>
        ) : null}
      </Sheet>
    </>
  );
}
