import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { doorsLabel, expectedToday, occurrences, timeLabel, visitsByDay, visitsByMember, walkIns } from "@rallix/stats";
import { inClub, requirePermission } from "../../../../lib/context";
import { listHereNow, listPeople, listVisits } from "../../../../lib/attendance-queries";
import { todayInClub } from "../../../../lib/highlights";
import { comingOn } from "../../../../lib/rsvp-queries";
import { listScheduleEvents } from "../../../../lib/schedule-queries";
import { AttendanceManager } from "./AttendanceManager";

export const dynamic = "force-dynamic";

/** The club roll: who is here, door check-in by card scan or by name, and how often people come. Members admin only. */
export default async function Attendance() {
  const ctx = await requirePermission("members");
  const today = todayInClub();
  const d = await inClub(ctx, async (tx) => ({ here: await listHereNow(tx, ctx.club.clubId), visits: await listVisits(tx, ctx.club.clubId, 14), people: await listPeople(tx, ctx.club.clubId), rsvps: await comingOn(tx, ctx.club.clubId, today), schedule: await listScheduleEvents(tx, ctx.club.clubId) }));
  const names = new Map(d.people.map((p) => [p.id, p]));
  const days = visitsByDay(d.visits, today, 14);
  const regulars = visitsByMember(d.visits).slice(0, 8).map((m) => ({ ...m, name: names.get(m.memberId)?.name ?? "Former member", photo: names.get(m.memberId)?.photo ?? null }));
  const hereIds = d.here.map((h) => h.membershipId);
  const sessions = occurrences(d.schedule, today, today).filter((o) => o.kind !== "closed");
  const expected = expectedToday(d.rsvps, hereIds).map((x) => {
    const o = sessions.find((s) => s.eventId === x.eventId);
    return { eventId: x.eventId, title: o?.title ?? "Session", time: o ? [doorsLabel(o), timeLabel(o)].filter(Boolean).join(" · ") : "", coming: x.coming, arrived: x.arrived, notYet: x.notYet.map((id) => d.rsvps.find((r) => r.memberId === id)?.name ?? "Former member") };
  });
  const walk = walkIns(d.rsvps, hereIds);
  return (
    <PageShell back={<BackButton href="/members" linkAs={Link} />} title="Attendance">
      <AttendanceManager today={today} here={d.here.map((h) => ({ id: h.membershipId, name: h.name, photo: h.photo, since: h.since.toISOString(), method: h.method }))}
        people={d.people} days={days} regulars={regulars} expected={expected} walkIns={expected.length ? walk : 0} />
    </PageShell>
  );
}
