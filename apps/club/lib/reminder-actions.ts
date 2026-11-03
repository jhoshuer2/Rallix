"use server";
import { and, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditLog, emailLog, reminderSettings } from "@rallix/db";
import { checkOffsets } from "@rallix/payments";
import { inClub, can, requireClub } from "./context";
import { serviceDb } from "./db";
import { logEmail, mailer } from "./mail";
import { buildReminderMessage, runDueReminders } from "./reminders-core";

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Turn reminders on or off and choose the days. Admins of THIS club only (the database enforces it too). */
export async function saveReminderSettings(input: { enabled: boolean; offsets: number[] }): Promise<Res> {
  const ctx = await requireClub();
  if (!can(ctx.club, "finance")) return fail("Only club admins can change reminder settings.");
  const c = checkOffsets(input.offsets);
  if (!c.ok) return fail(c.error);
  await inClub(ctx, (tx) => tx.insert(reminderSettings).values({ clubId: ctx.club.clubId, enabled: !!input.enabled, offsets: c.offsets })
    .onConflictDoUpdate({ target: reminderSettings.clubId, set: { enabled: !!input.enabled, offsets: c.offsets, updatedAt: new Date() } }));
  await serviceDb().insert(auditLog).values({ actorId: ctx.user.id, action: input.enabled ? "club.reminders_on" : "club.reminders_off", entity: "club", entityId: ctx.club.clubId, meta: { offsets: c.offsets } });
  revalidatePath("/membership/reminders");
  return { ok: true };
}

/** Send the admin a sample reminder, using the real template and their own address, so they can see exactly what members get. */
export async function sendTestReminder(): Promise<Res> {
  const ctx = await requireClub();
  if (!can(ctx.club, "finance")) return fail("Only club admins can send a test.");
  const [recent] = await serviceDb().select({ n: sql<number>`count(*)::int` }).from(emailLog)
    .where(and(eq(emailLog.kind, "reminder"), eq(emailLog.relatedId, `test:${ctx.club.clubId}`), gt(emailLog.createdAt, new Date(Date.now() - 3600_000))));
  if ((recent?.n ?? 0) >= 5) return fail("You’ve sent several test emails already. Please wait a little.");
  const [t] = (await serviceDb().execute(sql`select subject, body from templates where key = 'dues_reminder'`)).rows as Array<{ subject: string; body: string }>;
  if (!t) return fail("The reminder template is missing.");
  try {
    const m = buildReminderMessage(t, { userId: ctx.user.id, to: ctx.user.email, name: ctx.user.name, club: ctx.club.name, amountKobo: 600000, dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), offset: -3 });
    const r = await mailer().send({ ...m, subject: `[Test] ${m.subject}` });
    await logEmail({ to: ctx.user.email, kind: "reminder", ok: r.ok, error: r.ok ? undefined : r.error, templateKey: "dues_reminder_test", relatedId: `test:${ctx.club.clubId}` });
    return r.ok ? { ok: true } : fail("The test email could not be sent. Please try again.");
  } catch { return fail("The reminder template can’t be filled in. Ask Rallix support to check it."); }
}

/** Run today's schedule for THIS club now (the same thing the daily job does). Nothing is ever sent twice. */
export async function runRemindersNow(): Promise<Res<{ sent: number; failed: number; waiting: number }>> {
  const ctx = await requireClub();
  if (!can(ctx.club, "finance")) return fail("Only club admins can do this.");
  const r = await runDueReminders({ clubId: ctx.club.clubId, maxEmails: 100 });
  if (!r.ok) return fail(r.error);
  revalidatePath("/membership/reminders");
  const c = r.clubs[0];
  return { ok: true, sent: r.sent, failed: r.failed, waiting: c ? Math.max(0, c.candidates - c.sent - c.failed) : 0 };
}
