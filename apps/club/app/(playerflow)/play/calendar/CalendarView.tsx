"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, ListGroup, ListRow, Pill, Segmented } from "@rallix/ui";
import { dayLabel, groupByDay, rangeEnd, type CalendarRange } from "@rallix/stats";
import { setComing } from "../../../../lib/rsvp-actions";

export type CalItem = {
  key: string; date: string; title: string; subtitle: string; kind: "play" | "event" | "closed";
  /** Set for club sessions and events a member can say they are coming to. */
  eventId: string | null; going: boolean; href?: string;
};

export function CalendarView({ items, today }: { items: CalItem[]; today: string }) {
  const router = useRouter();
  const [range, setRange] = useState<CalendarRange>("week");
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState<string>();
  const end = rangeEnd(range, today);
  const days = groupByDay(items.filter((i) => i.date <= end));

  async function toggle(i: CalItem) {
    if (!i.eventId) return;
    setBusy(i.key); setErr(undefined);
    const r = await setComing(i.eventId, i.date, !i.going);
    setBusy(undefined);
    if (!r.ok) setErr(r.error); else router.refresh();
  }
  return (
    <>
      <Segmented label="Show" value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }]} />
      <div style={{ height: 16 }} />
      {err ? <p role="alert" className="rx-error">{err}</p> : null}
      {days.length === 0 ? <EmptyState compact title={range === "today" ? "Nothing today" : "Nothing coming up"} hint={range === "month" ? "Playing times, events and closures set by your club show up here." : "Try a longer range."} /> : days.map((g) => (
        <div key={g.date} className="rx-block">
          <p className="rx-label" style={{ margin: "0 0 8px" }}>{dayLabel(g.date, today)}</p>
          <ListGroup label={dayLabel(g.date, today)}>
            {g.items.map((i) => (
              <ListRow key={i.key} title={i.title} subtitle={i.subtitle} href={i.href} linkAs={i.href ? Link : undefined}
                trailing={i.kind === "closed" ? <Pill tone="warning">Closed</Pill> : i.eventId ? (
                  <button type="button" className={i.going ? "rx-btn rx-btn--small" : "rx-btn rx-btn--small rx-btn--ghost"} disabled={busy === i.key} aria-pressed={i.going}
                    aria-label={`${i.going ? "Not coming to" : "I’m coming to"} ${i.title}`} onClick={() => void toggle(i)}>{i.going ? "Coming ✓" : "I’m coming"}</button>
                ) : undefined} />
            ))}
          </ListGroup>
        </div>
      ))}
    </>
  );
}
