import Link from "next/link";
import { BackButton, EmptyState, ListGroup, ListRow, PageShell, Pill } from "@rallix/ui";
import { addDays, dayLabel, groupByDay, occurrences, timeLabel, type ScheduleEvent } from "@rallix/stats";
import { inClub, requireClub } from "../../../../lib/context";
import { todayInClub } from "../../../../lib/highlights";
import { listCompetitionsForPlayer, listMatches } from "../../../../lib/queries";
import { listScheduleEvents } from "../../../../lib/schedule-queries";

export const dynamic = "force-dynamic";
const DAYS = 30;
const lagos = (d: Date) => todayInClub(d);
const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/** The next 30 days at the club: regular sessions, events, closures, competitions starting, and your own matches. */
export default async function Calendar() {
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const today = todayInClub();
  const to = addDays(today, DAYS);
  const d = await inClub(ctx, async (tx) => ({
    events: await listScheduleEvents(tx, ctx.club.clubId),
    comps: await listCompetitionsForPlayer(tx, ctx.club.clubId, me),
    mine: await listMatches(tx, ctx.club.clubId, { memberId: me }),
  }));
  // Competitions and my matches join the same list as extra one-off events.
  const extra: Array<ScheduleEvent & { href?: string }> = [
    ...d.comps.filter((c) => c.startsOn && c.startsOn >= today && c.startsOn <= to && (c.status === "draft" || c.status === "active")).map((c) => ({ id: `c-${c.id}`, kind: "event" as const, title: `${c.name} starts`, startsOn: c.startsOn!, href: `/play/compete/${c.id}` })),
    ...d.mine.filter((m) => m.status === "scheduled" && m.scheduledAt && m.p1 && m.p2 && lagos(m.scheduledAt) >= today && lagos(m.scheduledAt) <= to).map((m) => ({ id: `m-${m.id}`, kind: "event" as const, title: `${m.p1!.id === me ? m.p2!.name : m.p1!.name} · ${m.competitionName}`, note: "Your match", startsOn: lagos(m.scheduledAt!), startTime: hhmm(m.scheduledAt!), href: `/play/compete/${m.competitionId}` })),
  ];
  const hrefs = new Map(extra.map((e) => [e.id, e.href]));
  const days = groupByDay(occurrences([...d.events, ...extra], today, to));
  return (
    <PageShell back={<BackButton href="/play/compete" linkAs={Link} />} title="Calendar">
      {days.length === 0 ? <EmptyState title="Nothing on the calendar" hint="Playing times, events and closures set by your club show up here." /> : days.map((g) => (
        <div key={g.date} className="rx-block">
          <p className="rx-label" style={{ margin: "0 0 8px" }}>{dayLabel(g.date, today)}</p>
          <ListGroup label={dayLabel(g.date, today)}>
            {g.items.map((o) => {
              const href = hrefs.get(o.eventId);
              return <ListRow key={`${o.eventId}-${o.date}`} title={o.title} subtitle={o.kind === "closed" ? (o.note ?? "The club is closed") : `${timeLabel(o)}${o.note ? ` · ${o.note}` : ""}`}
                trailing={o.kind === "closed" ? <Pill tone="warning">Closed</Pill> : undefined} href={href} linkAs={href ? Link : undefined} />;
            })}
          </ListGroup>
        </div>
      ))}
    </PageShell>
  );
}
