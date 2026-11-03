import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { inClub, requirePermission } from "../../../../lib/context";
import { listScheduleEvents } from "../../../../lib/schedule-queries";
import { todayInClub } from "../../../../lib/highlights";
import { ScheduleManager } from "./ScheduleManager";

export const dynamic = "force-dynamic";

/** Regular sessions, events and closures. The Facilities admin edits it; everyone in the club reads it on their calendar. */
export default async function Schedule() {
  const ctx = await requirePermission("facilities");
  const events = await inClub(ctx, (tx) => listScheduleEvents(tx, ctx.club.clubId));
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Schedule">
      <ScheduleManager events={events} today={todayInClub()} />
    </PageShell>
  );
}
