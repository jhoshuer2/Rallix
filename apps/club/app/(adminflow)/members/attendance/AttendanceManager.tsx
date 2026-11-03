"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, ListGroup, ListRow, Photo, Pill, Sheet, TextField } from "@rallix/ui";
import type { DayCount, MemberVisits } from "@rallix/stats";
import { CardScanner } from "../../../../components/CardScanner";
import { doorCheckIn, doorCheckOut, lookupCard, type Scanned } from "../../../../lib/attendance-actions";

type Person = { id: string; name: string; photo: string | null };
type Here = Person & { since: string; method: string };
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const TONE = { good: "success", due: "warning", overdue: "warning" } as const;

export function AttendanceManager({ today, here, people, days, regulars, expected, walkIns }: { today: string; here: Here[]; people: Person[]; days: DayCount[]; regulars: Array<MemberVisits & { name: string; photo: string | null }>; expected: Array<{ eventId: string; title: string; time: string; coming: number; arrived: number; notYet: string[] }>; walkIns: number }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<null | "pick" | "scan">(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const hereIds = new Set(here.map((h) => h.id));
  const close = () => { setSheet(null); setScanned(null); setMsg(undefined); setQ(""); };
  const shown = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const maxVisits = Math.max(1, ...days.map((d) => d.people));

  async function act(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, done?: () => void) {
    setBusy(true); setMsg(undefined);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    done?.(); router.refresh();
  }
  const onToken = useCallback(async (token: string) => {
    const r = await lookupCard(token);
    if (r.ok) { setScanned(r.person); setMsg(undefined); } else { setScanned(null); setMsg(r.error); }
  }, []);

  return (
    <>
      <div className="rx-fieldpair">
        <Button onClick={() => setSheet("scan")}>Scan a card</Button>
        <Button variant="ghost" onClick={() => setSheet("pick")}>Check in by name</Button>
      </div>

      {expected.length ? (
        <div className="rx-block">
          <p className="rx-label" style={{ margin: "0 0 8px" }}>Expected today</p>
          <ListGroup label="Expected today">
            {expected.map((x) => <ListRow key={x.eventId} title={x.title} subtitle={`${x.time ? `${x.time} · ` : ""}${x.notYet.length ? `Still to come: ${x.notYet.slice(0, 4).join(", ")}${x.notYet.length > 4 ? ` and ${x.notYet.length - 4} more` : ""}` : "Everyone has arrived"}`} trailing={`${x.arrived} of ${x.coming} here`} />)}
          </ListGroup>
          {walkIns > 0 ? <p className="rx-muted" style={{ margin: "8px 0 0" }}>{walkIns} {walkIns === 1 ? "person" : "people"} here didn’t say they were coming.</p> : null}
        </div>
      ) : null}

      <div className="rx-block">
        <p className="rx-label" style={{ margin: "0 0 8px" }}>Here now · {here.length}</p>
        {here.length === 0 ? <EmptyState compact title="Nobody checked in" hint="People who check in on their phone or at the door show up here." /> : (
          <ListGroup label="Here now">
            {here.map((h) => <ListRow key={h.id} media={<Photo src={h.photo} name={h.name} alt="" />} title={h.name} subtitle={`Since ${hm(h.since)}${h.method === "door" ? " · at the door" : ""}`}
              trailing={<button type="button" className="rx-linkbtn" disabled={busy} aria-label={`Check out ${h.name}`} onClick={(e) => { e.stopPropagation(); void act(() => doorCheckOut(h.id)); }}>Check out</button>} />)}
          </ListGroup>
        )}
      </div>

      {days.some((d) => d.visits > 0) ? (
        <div className="rx-block">
          <p className="rx-label" style={{ margin: "0 0 8px" }}>Last 14 days</p>
          <ListGroup label="Visits by day">
            {[...days].reverse().filter((d) => d.visits > 0 || d.date === today).map((d) => (
              <ListRow key={d.date} title={d.date === today ? "Today" : dayName(d.date)} subtitle={`${d.people} ${d.people === 1 ? "person" : "people"}`}
                trailing={<span aria-hidden style={{ display: "inline-block", height: 8, width: `${Math.max(6, (d.people / maxVisits) * 80)}px`, background: "var(--rx-blue)", borderRadius: 4 }} />} />
            ))}
          </ListGroup>
        </div>
      ) : null}

      {regulars.length ? (
        <div className="rx-block">
          <p className="rx-label" style={{ margin: "0 0 8px" }}>Most regular</p>
          <ListGroup label="Most regular">
            {regulars.map((m) => <ListRow key={m.memberId} media={<Photo src={m.photo} name={m.name} alt="" />} title={m.name} subtitle={`Last seen ${m.last === today ? "today" : dayName(m.last)}`} trailing={`${m.days} ${m.days === 1 ? "day" : "days"}`} />)}
          </ListGroup>
        </div>
      ) : null}

      <Sheet open={sheet === "pick"} onClose={close} title="Check in by name">
        <TextField label="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
        {msg ? <p role="alert" className="rx-error">{msg}</p> : null}
        <ListGroup bare label="Members">
          {shown.slice(0, 50).map((p) => <ListRow key={p.id} media={<Photo src={p.photo} name={p.name} alt="" />} title={p.name} subtitle={hereIds.has(p.id) ? "Already here" : undefined}
            onClick={hereIds.has(p.id) ? undefined : () => void act(() => doorCheckIn(p.id), close)} />)}
        </ListGroup>
        {shown.length === 0 ? <p className="rx-muted">No one matches.</p> : null}
      </Sheet>

      <Sheet open={sheet === "scan"} onClose={close} title="Scan a member card">
        {sheet === "scan" && !scanned ? <CardScanner onToken={onToken} /> : null}
        {msg && !scanned ? <p role="alert" className="rx-error">{msg}</p> : null}
        {scanned ? (
          <div style={{ display: "grid", gap: 12 }}>
            <ListGroup label="Scanned member"><ListRow media={<Photo src={scanned.photo} name={scanned.name} alt="" />} title={scanned.name} subtitle={scanned.here ? "Already checked in" : undefined} trailing={<Pill tone={TONE[scanned.standing]}>{scanned.standingLabel}</Pill>} /></ListGroup>
            {msg ? <p role="alert" className="rx-error" style={{ margin: 0 }}>{msg}</p> : null}
            {scanned.here ? <Button block variant="ghost" onClick={close}>Done</Button> : <Button block disabled={busy} onClick={() => void act(() => doorCheckIn(scanned.id), close)}>Let in</Button>}
            <Button block variant="ghost" onClick={() => { setScanned(null); setMsg(undefined); }}>Scan another</Button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
