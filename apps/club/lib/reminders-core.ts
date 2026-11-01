import { and, eq, inArray, sql } from "drizzle-orm";
import { auditLog, clubs, dues, memberships, reminderLog, reminderSettings, users } from "@rallix/db";
import { compose, placeholdersIn, TEMPLATE_PLACEHOLDERS } from "@rallix/mailer";
import { nextReminder, timingPhrase } from "@rallix/payments";
import { serviceDb } from "./db";
import { logEmail, mailer } from "./mail";
import { appUrl } from "./payments";
import { unsubscribeApiUrl, unsubscribePageUrl } from "./unsubscribe";

const MAX_ATTEMPTS = 3;
const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
const fmtDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export type ClubRun = { clubId: string; club: string; today: string; candidates: number; sent: number; failed: number; skippedAlreadySent: number };
export type RunSummary = { ok: true; clubs: ClubRun[]; sent: number; failed: number; capped: boolean } | { ok: false; error: string };

type Template = { subject: string; body: string };

/** Load the template and make sure it only uses placeholders we can fill. A broken template stops the whole run BEFORE anything is sent. */
async function loadTemplate(): Promise<Template | { error: string }> {
  const [t] = (await serviceDb().execute(sql`select subject, body from templates where key = 'dues_reminder'`)).rows as Array<{ subject: string | null; body: string }>;
  if (!t || !t.subject) return { error: "The dues reminder template is missing." };
  const allowed = TEMPLATE_PLACEHOLDERS.dues_reminder!;
  const bad = placeholdersIn(`${t.subject}\n${t.body}`).filter((p) => !allowed.includes(p));
  if (bad.length) return { error: `The dues reminder template uses unknown placeholders: ${bad.map((b) => `{{${b}}}`).join(", ")}. Fix it in the console under Templates.` };
  return { subject: t.subject, body: t.body };
}

export function buildReminderMessage(t: Template, v: { userId: string; to: string; name: string; club: string; amountKobo: number; dueDate: string; offset: number }) {
  const m = compose({
    subject: t.subject, body: t.body, company: "Rallix",
    vars: { player_name: v.name.trim().split(/\s+/)[0] || "there", club_name: v.club, amount: naira(v.amountKobo), due_date: fmtDate(v.dueDate), timing: timingPhrase(v.offset), pay_link: `${appUrl()}/play/me/payments` },
    footer: `You are getting this because you are a member of ${v.club} on Rallix.\nDon't want these emails? Unsubscribe: ${unsubscribePageUrl(v.userId)}`,
  });
  return { to: v.to, ...m, unsubscribeUrl: unsubscribeApiUrl(v.userId) };
}

/**
 * Send today's dues reminders. Safe to run as often as you like, from anywhere, at the same time:
 *  - a reminder (due + day-offset) is CLAIMED by inserting its log row; only the claimer sends it
 *  - failures are retried (up to 3 attempts) on later runs; stale "sending" claims are retaken after 10 minutes
 *  - a paid due, a left or suspended member, an opted-out player or a club with reminders off is never emailed
 * `today` may only be overridden outside production (tests). `maxEmails` bounds one run; the rest go out next run (grace period).
 */
export async function runDueReminders(opts: { clubId?: string; today?: string; maxEmails?: number } = {}): Promise<RunSummary> {
  const db = serviceDb();
  const production = process.env.NODE_ENV === "production";
  const override = !production && opts.today && /^\d{4}-\d{2}-\d{2}$/.test(opts.today) ? opts.today : null;
  const tpl = await loadTemplate();
  if ("error" in tpl) return { ok: false, error: tpl.error };

  const settings = await db.select({ clubId: reminderSettings.clubId, offsets: reminderSettings.offsets, name: clubs.name, tz: clubs.timezone })
    .from(reminderSettings).innerJoin(clubs, eq(clubs.id, reminderSettings.clubId))
    .where(and(eq(reminderSettings.enabled, true), eq(clubs.status, "active"), ...(opts.clubId ? [eq(reminderSettings.clubId, opts.clubId)] : [])));

  let budget = opts.maxEmails ?? 300, capped = false, sentTotal = 0, failedTotal = 0;
  const out: ClubRun[] = [];
  for (const s of settings) {
    const today = override ?? ((await db.execute(sql`select (now() at time zone ${s.tz})::date::text as d`)).rows[0] as { d: string }).d;
    const run: ClubRun = { clubId: s.clubId, club: s.name, today, candidates: 0, sent: 0, failed: 0, skippedAlreadySent: 0 };
    out.push(run);

    const candidates = await db.select({ dueId: dues.id, amountKobo: dues.amountKobo, dueDate: sql<string>`${dues.dueDate}::text`, userId: users.id, email: users.email, name: users.name })
      .from(dues).innerJoin(memberships, eq(memberships.id, dues.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(dues.clubId, s.clubId), inArray(dues.status, ["due", "overdue"]), eq(memberships.status, "active"), eq(users.emailOptOut, false), sql`${dues.amountKobo} > 0`));
    if (!candidates.length) continue;
    const logs = await db.select({ dueId: reminderLog.dueId, offset: reminderLog.offsetDays, status: reminderLog.status, attempts: reminderLog.attempts, createdAt: reminderLog.createdAt })
      .from(reminderLog).where(inArray(reminderLog.dueId, candidates.map((c) => c.dueId)));
    const finished = (l: (typeof logs)[number]) => l.status === "sent" || (l.status === "failed" && l.attempts >= MAX_ATTEMPTS) || (l.status === "sending" && Date.now() - l.createdAt.getTime() < 10 * 60_000);

    for (const c of candidates) {
      const done = new Set(logs.filter((l) => l.dueId === c.dueId && finished(l)).map((l) => l.offset));
      const offset = nextReminder({ dueDate: c.dueDate, today, offsets: s.offsets, alreadySent: done });
      if (offset === null) { if (done.size) run.skippedAlreadySent++; continue; }
      run.candidates++;
      if (budget <= 0) { capped = true; continue; }

      // Claim. Returns a row only for the one runner that gets to send (new row, or a retry of a failed/stale one).
      const claim = await db.execute(sql`insert into reminder_log (club_id, due_id, offset_days, user_id, email) values (${s.clubId}, ${c.dueId}, ${offset}, ${c.userId}, ${c.email})
        on conflict (due_id, offset_days) do update set attempts = reminder_log.attempts + 1, status = 'sending', error = null, created_at = now(), user_id = excluded.user_id, email = excluded.email
        where (reminder_log.status = 'failed' and reminder_log.attempts < ${MAX_ATTEMPTS}) or (reminder_log.status = 'sending' and reminder_log.created_at < now() - interval '10 minutes')
        returning id`);
      const id = (claim.rows[0] as { id: string } | undefined)?.id;
      if (!id) { run.skippedAlreadySent++; continue; }
      budget--;

      let ok = false, error: string | undefined;
      try {
        const r = await mailer().send(buildReminderMessage(tpl, { userId: c.userId, to: c.email, name: c.name, club: s.name, amountKobo: c.amountKobo, dueDate: c.dueDate, offset }));
        ok = r.ok; if (!r.ok) error = r.error;
      } catch (e) { error = (e as Error).message; }
      await db.update(reminderLog).set(ok ? { status: "sent", sentAt: new Date(), error: null } : { status: "failed", error: (error ?? "failed").slice(0, 300) }).where(eq(reminderLog.id, id));
      await logEmail({ to: c.email, kind: "reminder", ok, error, templateKey: "dues_reminder", relatedId: c.dueId });
      ok ? (run.sent++, sentTotal++) : (run.failed++, failedTotal++);
    }
  }
  if (sentTotal + failedTotal > 0) await db.insert(auditLog).values({ actorId: null, action: "reminders.run", entity: "club", entityId: opts.clubId ?? null, meta: { sent: sentTotal, failed: failedTotal, clubs: out.map((c) => ({ club: c.club, sent: c.sent, failed: c.failed })) } });
  return { ok: true, clubs: out, sent: sentTotal, failed: failedTotal, capped };
}
