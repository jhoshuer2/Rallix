import { asc, eq } from "drizzle-orm";
import { clubEvents, type Tx } from "@rallix/db";
import type { EventKind, ScheduleEvent } from "@rallix/stats";

/** Every schedule entry of the club (members can read them all; the list is small). */
export async function listScheduleEvents(tx: Tx, clubId: string): Promise<ScheduleEvent[]> {
  const rows = await tx.select().from(clubEvents).where(eq(clubEvents.clubId, clubId)).orderBy(asc(clubEvents.startsOn), asc(clubEvents.startTime));
  return rows.map((r) => ({ id: r.id, kind: r.kind as EventKind, title: r.title, note: r.note, startsOn: r.startsOn, endsOn: r.endsOn, startTime: r.startTime, endTime: r.endTime, doorsOpen: r.doorsOpen, repeatsWeekly: r.repeatsWeekly, until: r.until }));
}
