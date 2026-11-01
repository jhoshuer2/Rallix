import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { dues, memberships, reminderLog, reminderSettings, users } from "@rallix/db";
import { DEFAULT_OFFSETS } from "@rallix/payments";
import { inClub, type Ctx, type MyClub } from "./context";
import { serviceDb } from "./db";

type C = Ctx & { club: MyClub };

export async function reminderSettingsFor(ctx: C) {
  const [r] = await inClub(ctx, (tx) => tx.select({ enabled: reminderSettings.enabled, offsets: reminderSettings.offsets }).from(reminderSettings).where(eq(reminderSettings.clubId, ctx.club.clubId)));
  return r ?? { enabled: false, offsets: [...DEFAULT_OFFSETS] as number[] };
}

/** History and counts for an admin's own club. Service role, but scoped by the club id the caller was verified as admin of. */
export async function reminderOverview(ctx: C) {
  const db = serviceDb();
  const recent = await db.select({ name: users.name, offset: reminderLog.offsetDays, status: reminderLog.status, error: reminderLog.error, at: reminderLog.createdAt })
    .from(reminderLog).innerJoin(dues, eq(dues.id, reminderLog.dueId)).innerJoin(memberships, eq(memberships.id, dues.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(reminderLog.clubId, ctx.club.clubId)).orderBy(desc(reminderLog.createdAt)).limit(15);
  const [counts] = (await db.execute(sql`select
    count(*) filter (where d.status in ('due','overdue') and m.status = 'active')::int as unpaid,
    count(*) filter (where d.status in ('due','overdue') and m.status = 'active' and u.email_opt_out)::int as opted_out
    from dues d join memberships m on m.id = d.membership_id join users u on u.id = m.user_id where d.club_id = ${ctx.club.clubId}`)).rows as Array<{ unpaid: number; opted_out: number }>;
  return { recent, unpaid: counts?.unpaid ?? 0, optedOut: counts?.opted_out ?? 0 };
}

/** How many reminders each of this club's dues has had. */
export async function reminderCounts(clubId: string, dueIds: string[]): Promise<Map<string, number>> {
  if (!dueIds.length) return new Map();
  const rows = await serviceDb().select({ dueId: reminderLog.dueId, n: sql<number>`count(*)::int` }).from(reminderLog)
    .where(and(eq(reminderLog.clubId, clubId), eq(reminderLog.status, "sent"), inArray(reminderLog.dueId, dueIds))).groupBy(reminderLog.dueId);
  return new Map(rows.map((r) => [r.dueId, r.n]));
}
