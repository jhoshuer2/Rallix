import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { addDays, doorsLabel, occurrences, timeLabel, type ScheduleEvent } from "@rallix/stats";
import { inClub, requireClub } from "../../../../lib/context";
import { todayInClub } from "../../../../lib/highlights";
import { listCompetitionsForPlayer, listMatches } from "../../../../lib/queries";
import { myComing } from "../../../../lib/rsvp-queries";
import { listScheduleEvents } from "../../../../lib/schedule-queries";
import { CalendarView, type CalItem } from "./CalendarView";

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
    coming: await myComing(tx, me, today, to),
  }));
  // Competitions and my matches join the same list as extra one-off events (no "I'm coming" for those: a match is already yours).
  const extra: Array<ScheduleEvent & { href?: string }> = [
    ...d.comps.filter((c) => c.startsOn && c.startsOn >= today && c.startsOn <= to && (c.status === "draft" || c.status === "active")).map((c) => ({ id: `c-${c.id}`, kind: "event" as const, title: `${c.name} starts`, startsOn: c.startsOn!, href: `/play/compete/${c.id}` })),
    ...d.mine.filter((m) => m.status === "scheduled" && m.scheduledAt && m.p1 && m.p2 && lagos(m.scheduledAt) >= today && lagos(m.scheduledAt) <= to).map((m) => ({ id: `m-${m.id}`, kind: "event" as const, title: `${m.p1!.id === me ? m.p2!.name : m.p1!.name} · ${m.competitionName}`, note: "Your match", startsOn: lagos(m.scheduledAt!), startTime: hhmm(m.scheduledAt!), href: `/play/compete/${m.competitionId}` })),
  ];
  const hrefs = new Map(extra.map((e) => [e.id, e.href]));
  const own = new Set(d.events.map((e) => e.id));
  const items: CalItem[] = occurrences([...d.events, ...extra], today, to).map((o) => ({
    key: `${o.eventId}-${o.date}`, date: o.date, title: o.title, kind: o.kind,
    subtitle: o.kind === "closed" ? (o.note ?? "The club is closed") : [doorsLabel(o), timeLabel(o), o.note].filter(Boolean).join(" · "),
    eventId: own.has(o.eventId) && o.kind !== "closed" ? o.eventId : null, going: d.coming.has(`${o.eventId}:${o.date}`), href: hrefs.get(o.eventId),
  }));
  return (
    <PageShell back={<BackButton href="/play/compete" linkAs={Link} />} title="Calendar">
      <CalendarView items={items} today={today} />
    </PageShell>
  );
}
