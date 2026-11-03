"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, ListGroup, ListRow, Pill, Segmented, Sheet, Switch, TextField } from "@rallix/ui";
import { timeLabel, type EventKind, type ScheduleEvent } from "@rallix/stats";
import { deleteScheduleEvent, saveScheduleEvent } from "../../../../lib/schedule-actions";

const KINDS: Array<{ value: EventKind; label: string }> = [{ value: "play", label: "Playing time" }, { value: "event", label: "Event" }, { value: "closed", label: "Closed" }];
const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
type Form = { id: string | null; kind: EventKind; title: string; note: string; startsOn: string; endsOn: string; startTime: string; endTime: string; doorsOpen: string; repeatsWeekly: boolean; until: string };
const blank = (today: string): Form => ({ id: null, kind: "play", title: "", note: "", startsOn: today, endsOn: "", startTime: "", endTime: "", doorsOpen: "", repeatsWeekly: true, until: "" });

export function ScheduleManager({ events, today }: { events: ScheduleEvent[]; today: string }) {
  const router = useRouter();
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const close = () => { setF(null); setMsg(undefined); };
  const open = (e: ScheduleEvent) => setF({ id: e.id, kind: e.kind, title: e.title, note: e.note ?? "", startsOn: e.startsOn, endsOn: e.endsOn ?? "", startTime: e.startTime ?? "", endTime: e.endTime ?? "", doorsOpen: e.doorsOpen ?? "", repeatsWeekly: !!e.repeatsWeekly, until: e.until ?? "" });

  async function save() {
    if (!f) return;
    setBusy(true); setMsg(undefined);
    const r = await saveScheduleEvent(f.id, f);
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    close(); router.refresh();
  }
  async function remove() {
    if (!f?.id) return;
    setBusy(true);
    const r = await deleteScheduleEvent(f.id);
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    close(); router.refresh();
  }
  const when = (e: ScheduleEvent) => {
    const t = `${e.doorsOpen ? `doors ${e.doorsOpen} · ` : ""}${timeLabel({ startTime: e.startTime ?? null, endTime: e.endTime ?? null })}`;
    if (e.repeatsWeekly) return `Every ${WEEKDAYS[new Date(`${e.startsOn}T12:00:00Z`).getUTCDay()]!.slice(0, -1)} · ${t}${e.until ? ` · until ${nice(e.until)}` : ""}`;
    return `${nice(e.startsOn)}${e.endsOn && e.endsOn !== e.startsOn ? ` – ${nice(e.endsOn)}` : ""}${e.kind === "closed" ? "" : ` · ${t}`}`;
  };
  const upcoming = (e: ScheduleEvent) => (e.repeatsWeekly ? !e.until || e.until >= today : (e.endsOn ?? e.startsOn) >= today);
  const groups: Array<[string, ScheduleEvent[]]> = [
    ["Regular playing times", events.filter((e) => e.kind === "play" && e.repeatsWeekly && upcoming(e))],
    ["Coming up", events.filter((e) => !(e.kind === "play" && e.repeatsWeekly) && upcoming(e))],
    ["Past", events.filter((e) => !upcoming(e)).reverse().slice(0, 10)],
  ];
  const has = groups.some(([, l]) => l.length);

  return (
    <>
      {!has ? <EmptyState title="Nothing scheduled" hint="Add your regular playing times, events and days the club is closed. Players see them on their calendar."
        action={<Button onClick={() => setF(blank(today))}>Add to the schedule</Button>} /> : (
        <>
          {groups.filter(([, l]) => l.length).map(([title, list]) => (
            <div key={title} className="rx-block">
              <p className="rx-label" style={{ margin: "0 0 8px" }}>{title}</p>
              <ListGroup label={title}>
                {list.map((e) => <ListRow key={e.id} title={e.title} subtitle={when(e)} trailing={e.kind === "closed" ? <Pill tone="warning">Closed</Pill> : e.kind === "event" ? <Pill>Event</Pill> : undefined} onClick={() => open(e)} />)}
              </ListGroup>
            </div>
          ))}
          <div style={{ marginTop: 16 }}><Button block onClick={() => setF(blank(today))}>Add to the schedule</Button></div>
        </>
      )}

      <Sheet open={f !== null} onClose={close} title={f?.id ? "Edit" : "Add to the schedule"}>
        {f ? (
          <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} style={{ display: "grid", gap: 12 }}>
            <Segmented label="What is it" value={f.kind} onChange={(v) => setF({ ...f, kind: v, repeatsWeekly: v === "play" ? f.repeatsWeekly : false, endsOn: v === "play" ? "" : f.endsOn })} options={KINDS} />
            <TextField label="Title" maxLength={80} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={f.kind === "closed" ? "Public holiday" : f.kind === "event" ? "Club social" : "Tuesday night"} />
            <TextField label={f.kind === "play" && f.repeatsWeekly ? "First date" : f.kind === "play" ? "Date" : "From"} type="date" value={f.startsOn} onChange={(e) => set("startsOn", e.target.value)} />
            {f.kind !== "play" ? <TextField label="To (optional)" type="date" min={f.startsOn} value={f.endsOn} onChange={(e) => set("endsOn", e.target.value)} /> : null}
            {f.kind !== "closed" ? (
              <div className="rx-fieldpair">
                <TextField label="Starts" type="time" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
                <TextField label="Ends" type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} />
              </div>
            ) : null}
            {f.kind !== "closed" && f.startTime ? <TextField label="Doors open (optional)" type="time" max={f.startTime} value={f.doorsOpen} onChange={(e) => set("doorsOpen", e.target.value)} /> : null}
            {f.kind === "play" ? <Switch label="Repeats every week" checked={f.repeatsWeekly} onChange={(v) => set("repeatsWeekly", v)} /> : null}
            {f.kind === "play" && f.repeatsWeekly ? <TextField label="Until (optional)" type="date" min={f.startsOn} value={f.until} onChange={(e) => set("until", e.target.value)} /> : null}
            <TextField label="Note (optional)" maxLength={280} value={f.note} onChange={(e) => set("note", e.target.value)} />
            {msg ? <p role="alert" className="rx-error" style={{ margin: 0 }}>{msg}</p> : null}
            <Button type="submit" block disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            {f.id ? <Button variant="ghost" block disabled={busy} onClick={remove}>Delete</Button> : null}
          </form>
        ) : null}
      </Sheet>
    </>
  );
}
