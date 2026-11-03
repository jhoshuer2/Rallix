"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isEmail } from "@rallix/mailer";
import { db } from "./db";
import { requireAdmin } from "./guard";
import { audienceCount } from "./queries";
import { uuid } from "./format";
import { clubAppUrl, newPayToken, payLinkUrl } from "./pay-link";
import { createDeliveries, deliverNotification, sendInvoiceEmails, sendSupportReply } from "./email-core";
import { isStaffRole } from "@rallix/config/staff";
import { PLACEHOLDERS } from "./placeholders";
import { placeholdersIn } from "@rallix/mailer";

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const pgCode = (e: unknown) => (e as { cause?: { code?: string }; code?: string })?.cause?.code ?? (e as { code?: string })?.code;

/** Every mutation records who did what. Called inside each action after requireAdmin(). */
async function audit(actor: string, action: string, entity: string, entityId: string | null, meta: Record<string, unknown> = {}) {
  await db().execute(sql`insert into audit_log (actor_id, action, entity, entity_id, meta) values (${actor}, ${action}, ${entity}, ${entityId}, ${JSON.stringify(meta)}::jsonb)`);
}
const nairaToKobo = (n: number) => Math.round(n * 100);
const validMoney = (k: number) => Number.isFinite(k) && k >= 0 && k <= 100_000_000_00;

/* ---------- Clubs ---------- */
export async function setClubStatus(clubId: string, status: "active" | "suspended" | "closed", reason: string, reasonType: "non_payment" | "other" = "other"): Promise<Res> {
  const staff = await requireAdmin("clubs_manage");
  if (!uuid.test(clubId) || !["active", "suspended", "closed"].includes(status) || !["non_payment", "other"].includes(reasonType)) return fail("Invalid request.");
  if (status !== "active" && reason.trim().length < 3) return fail("Give a short reason. It is recorded in the audit log.");
  // The reason type decides whether paying an overdue invoice brings the club back automatically. Only a non-payment suspension does.
  const stored = status === "suspended" ? reasonType : null;
  const r = await db().execute(sql`update clubs set status = ${status}::club_status, suspension_reason = ${stored}::suspension_reason where id = ${clubId} returning name`);
  if (!r.rows.length) return fail("Club not found.");
  await audit(staff.id, `club.${status === "active" ? "reactivate" : status}`, "club", clubId, { reason: reason.trim(), reasonType: stored, name: (r.rows[0] as { name: string }).name });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Billing ---------- */
export async function createSubscription(input: { clubId: string; period: "monthly" | "yearly"; naira: number }): Promise<Res> {
  const staff = await requireAdmin("billing");
  const kobo = nairaToKobo(input.naira);
  if (!uuid.test(input.clubId) || !["monthly", "yearly"].includes(input.period) || !validMoney(kobo)) return fail("Check the club, period and amount.");
  const end = new Date(); if (input.period === "monthly") end.setMonth(end.getMonth() + 1); else end.setFullYear(end.getFullYear() + 1);
  const r = await db().execute(sql`insert into club_subscriptions (club_id, period, status, amount_kobo, current_period_end) values (${input.clubId}, ${input.period}::plan_period, 'active', ${kobo}, ${end}) returning id`);
  await audit(staff.id, "subscription.create", "club_subscription", (r.rows[0] as { id: string }).id, { clubId: input.clubId, period: input.period, kobo });
  revalidatePath("/billing");
  return { ok: true };
}
export async function setSubscriptionStatus(id: string, status: "trialing" | "active" | "past_due" | "cancelled"): Promise<Res> {
  const staff = await requireAdmin("billing");
  if (!uuid.test(id) || !["trialing", "active", "past_due", "cancelled"].includes(status)) return fail("Invalid request.");
  await db().execute(sql`update club_subscriptions set status = ${status}::subscription_status where id = ${id}`);
  await audit(staff.id, "subscription.status", "club_subscription", id, { status });
  revalidatePath("/billing");
  return { ok: true };
}

export async function createInvoice(input: { clubId: string; periodLabel: string; naira: number; description: string; issueNow: boolean; emailNow?: boolean }): Promise<Res<{ id: string; emailed?: { sent: number; failed: number } | { error: string } }>> {
  const staff = await requireAdmin("billing");
  const kobo = nairaToKobo(input.naira);
  if (!uuid.test(input.clubId) || !validMoney(kobo) || input.periodLabel.trim().length < 3) return fail("Check the club, period label and amount.");
  try {
    const r = await db().execute(sql`insert into platform_invoices (club_id, number, status, amount_kobo, period_label, description, issued_at, due_at, pay_token)
      values (${input.clubId}, app.next_invoice_number(), ${input.issueNow ? "issued" : "draft"}::invoice_status, ${kobo}, ${input.periodLabel.trim()}, ${input.description.trim() || null},
              ${input.issueNow ? sql`now()` : null}, ${input.issueNow ? sql`now() + interval '14 days'` : null}, ${input.issueNow ? newPayToken() : null}) returning id, number`);
    const row = r.rows[0] as { id: string; number: string };
    await audit(staff.id, "invoice.create", "invoice", row.id, { number: row.number, kobo, issued: input.issueNow });
    revalidatePath("/invoices");
    let emailed: { sent: number; failed: number } | { error: string } | undefined;
    if (input.issueNow && input.emailNow) {
      const e = await sendInvoiceEmails(row.id, "invoice", true);
      emailed = "error" in e ? { error: e.error } : { sent: e.sent, failed: e.failed };
      await audit(staff.id, "invoice.email", "invoice", row.id, { kind: "invoice", result: emailed });
    }
    return { ok: true, id: row.id, emailed };
  } catch (e) {
    if (pgCode(e) === "23505") return fail("That club already has an invoice for this period.");
    return fail("Could not create the invoice.");
  }
}
export async function setInvoiceStatus(id: string, status: "issued" | "paid" | "void", paymentRef?: string): Promise<Res> {
  const staff = await requireAdmin("billing");
  if (!uuid.test(id) || !["issued", "paid", "void"].includes(status)) return fail("Invalid request.");
  if (status === "paid" && (paymentRef ?? "").trim().length < 2) return fail("Enter the payment reference (bank transfer or Paystack reference).");
  const r = await db().execute(sql`update platform_invoices set status = ${status}::invoice_status,
      issued_at = case when ${status} = 'issued' then coalesce(issued_at, now()) else issued_at end,
      due_at = case when ${status} = 'issued' then coalesce(due_at, now() + interval '14 days') else due_at end,
      pay_token = case when ${status} = 'issued' then coalesce(pay_token, ${newPayToken()}) else pay_token end,
      paid_at = case when ${status} = 'paid' then now() else paid_at end,
      payment_ref = case when ${status} = 'paid' then ${paymentRef?.trim() ?? null} else payment_ref end
    where id = ${id} and status <> 'paid' and status <> 'void' returning number`);
  if (!r.rows.length) return fail("This invoice is already paid or void, so it can no longer change.");
  await audit(staff.id, `invoice.${status}`, "invoice", id, { number: (r.rows[0] as { number: string }).number, paymentRef: paymentRef?.trim() });
  revalidatePath("/invoices"); revalidatePath(`/invoices/${id}`); revalidatePath("/billing");
  return { ok: true };
}
/** One invoice per active subscription for the period. Monthly subs get YYYY-MM, yearly subs get YYYY. Safe to run twice. */
export async function generateInvoices(): Promise<Res<{ created: number }>> {
  const staff = await requireAdmin("billing");
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, year = String(now.getFullYear());
  const subs = (await db().execute(sql`select s.club_id, s.period, s.amount_kobo from club_subscriptions s join clubs c on c.id = s.club_id where s.status = 'active' and c.status = 'active'`)).rows as Array<{ club_id: string; period: string; amount_kobo: number }>;
  let created = 0;
  for (const s of subs) {
    const label = s.period === "monthly" ? month : year;
    const r = await db().execute(sql`insert into platform_invoices (club_id, number, status, amount_kobo, period_label, description, issued_at, due_at, pay_token)
      select ${s.club_id}, app.next_invoice_number(), 'issued', ${s.amount_kobo}, ${label}, ${`Rallix ${s.period} subscription, ${label}`}, now(), now() + interval '14 days', ${newPayToken()}
      where not exists (select 1 from platform_invoices where club_id = ${s.club_id} and period_label = ${label}) returning id`);
    created += r.rows.length;
  }
  await audit(staff.id, "invoice.generate", "invoice", null, { created, month, year });
  revalidatePath("/invoices"); revalidatePath("/billing");
  return { ok: true, created };
}

/* ---------- Templates and settings ---------- */
export async function saveTemplate(input: { id: string; subject: string; body: string }): Promise<Res> {
  const staff = await requireAdmin("templates");
  if (!uuid.test(input.id) || input.body.trim().length < 5 || input.body.length > 2000) return fail("The message body must be 5 to 2,000 characters.");
  const found = (await db().execute(sql`select key from templates where id = ${input.id}`)).rows[0] as { key: string } | undefined;
  if (!found) return fail("Template not found.");
  const allowed = PLACEHOLDERS[found.key] ?? [];
  const unknown = placeholdersIn(`${input.subject}\n${input.body}`).filter((p) => !allowed.includes(p));
  if (unknown.length) return fail(`Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{{${u}}}`).join(", ")}. This template can use: ${allowed.map((a) => `{{${a}}}`).join(", ")}.`);
  if (/[\r\n]/.test(input.subject)) return fail("The subject must be a single line.");
  const r = await db().execute(sql`update templates set subject = ${input.subject.trim() || null}, body = ${input.body}, updated_by = ${staff.id}, updated_at = now() where id = ${input.id} returning key`);
  if (!r.rows.length) return fail("Template not found.");
  await audit(staff.id, "template.update", "template", input.id, { key: (r.rows[0] as { key: string }).key });
  revalidatePath("/templates");
  return { ok: true };
}
export async function saveSettings(input: { companyName: string; address: string; email: string; phone: string; invoicePrefix: string; vatPercent: number; footerNote: string; paymentInstructions: string }): Promise<Res> {
  const staff = await requireAdmin("billing");
  if (input.companyName.trim().length < 2) return fail("Enter the company name.");
  if (!/^[A-Z0-9]{2,6}$/.test(input.invoicePrefix)) return fail("The invoice prefix must be 2 to 6 capital letters or digits.");
  if (!Number.isInteger(input.vatPercent) || input.vatPercent < 0 || input.vatPercent > 100) return fail("VAT must be a whole number from 0 to 100.");
  await db().execute(sql`update platform_settings set company_name = ${input.companyName.trim()}, address = ${input.address}, email = ${input.email.trim()}, phone = ${input.phone.trim()},
      invoice_prefix = ${input.invoicePrefix}, vat_percent = ${input.vatPercent}, footer_note = ${input.footerNote}, payment_instructions = ${input.paymentInstructions}, updated_at = now() where id = 1`);
  await audit(staff.id, "settings.update", "settings", "1", { invoicePrefix: input.invoicePrefix, vatPercent: input.vatPercent });
  revalidatePath("/templates"); revalidatePath("/invoices", "layout");
  return { ok: true };
}

/* ---------- Notifications ---------- */
export async function sendNotification(input: { title: string; body: string; channel: "push" | "email" | "sms" | "whatsapp"; audience: "all_admins" | "all_players" | "clubs"; clubIds: string[] }): Promise<Res<{ recipients: number; sent?: number; failed?: number; remaining?: number }>> {
  const staff = await requireAdmin("notifications");
  if (input.title.trim().length < 3 || input.body.trim().length < 5) return fail("Add a title and a message.");
  if (!["push", "email", "sms", "whatsapp"].includes(input.channel) || !["all_admins", "all_players", "clubs"].includes(input.audience)) return fail("Invalid request.");
  if (/[\r\n]/.test(input.title)) return fail("The title must be a single line.");
  const clubIds = input.audience === "clubs" ? input.clubIds.filter((c) => uuid.test(c)) : [];
  if (input.audience === "clubs" && clubIds.length === 0) return fail("Pick at least one club.");
  const recipients = await audienceCount({ type: input.audience, clubIds });
  if (recipients === 0) return fail("No one matches that audience.");
  const r = await db().execute(sql`insert into notifications (audience, channel, title, body, status, recipient_count, created_by) values (${JSON.stringify({ type: input.audience, clubIds })}::jsonb, ${input.channel}::notification_channel, ${input.title.trim()}, ${input.body.trim()}, 'queued', ${recipients}, ${staff.id}) returning id`);
  const id = (r.rows[0] as { id: string }).id;
  await audit(staff.id, "notification.queue", "notification", id, { channel: input.channel, audience: input.audience, recipients });
  revalidatePath("/notifications");
  // Only email has a delivery provider. The other channels stay queued until one is connected.
  if (input.channel !== "email") return { ok: true, recipients };
  await createDeliveries(id, { type: input.audience, clubIds });
  const d = await deliverNotification(id, 100);
  if ("error" in d) return fail(d.error);
  await audit(staff.id, "notification.send_batch", "notification", id, d);
  return { ok: true, recipients, ...d };
}

/* ---------- Issues ---------- */
export async function createIssue(input: { title: string; body: string; severity: "low" | "normal" | "high" | "critical"; clubId: string | null }): Promise<Res<{ id: string }>> {
  const staff = await requireAdmin("support");
  if (input.title.trim().length < 3) return fail("Give the issue a title.");
  if (!["low", "normal", "high", "critical"].includes(input.severity) || (input.clubId && !uuid.test(input.clubId))) return fail("Invalid request.");
  const r = await db().execute(sql`insert into issues (title, body, severity, club_id, reported_by, assigned_to) values (${input.title.trim()}, ${input.body.trim() || null}, ${input.severity}::issue_severity, ${input.clubId}, ${staff.id}, ${staff.id}) returning id`);
  const id = (r.rows[0] as { id: string }).id;
  await audit(staff.id, "issue.create", "issue", id, { severity: input.severity });
  revalidatePath("/issues", "layout");
  return { ok: true, id };
}
export async function updateIssue(id: string, patch: { status?: "open" | "investigating" | "resolved" | "closed"; severity?: "low" | "normal" | "high" | "critical"; assignToMe?: boolean }): Promise<Res> {
  const staff = await requireAdmin("support");
  if (!uuid.test(id)) return fail("Invalid request.");
  if (patch.status && !["open", "investigating", "resolved", "closed"].includes(patch.status)) return fail("Invalid status.");
  if (patch.severity && !["low", "normal", "high", "critical"].includes(patch.severity)) return fail("Invalid severity.");
  await db().execute(sql`update issues set status = coalesce(${patch.status ?? null}::issue_status, status), severity = coalesce(${patch.severity ?? null}::issue_severity, severity),
      assigned_to = case when ${!!patch.assignToMe} then ${staff.id} else assigned_to end,
      resolved_at = case when ${patch.status ?? null} in ('resolved','closed') then coalesce(resolved_at, now()) when ${patch.status ?? null} in ('open','investigating') then null else resolved_at end where id = ${id}`);
  await audit(staff.id, "issue.update", "issue", id, patch as Record<string, unknown>);
  revalidatePath("/issues", "layout");
  return { ok: true };
}
export async function addIssueNote(id: string, body: string): Promise<Res> {
  const staff = await requireAdmin("support");
  if (!uuid.test(id) || body.trim().length < 2) return fail("Write a note first.");
  await db().execute(sql`insert into issue_notes (issue_id, author_id, body) values (${id}, ${staff.id}, ${body.trim()})`);
  await db().execute(sql`update issues set updated_at = now() where id = ${id}`);
  await audit(staff.id, "issue.note", "issue", id);
  revalidatePath(`/issues/${id}`);
  return { ok: true };
}

/* ---------- Support replies ---------- */
/** Reply to a request sent from the club app: emailed to the person who sent it, and kept as a note. */
export async function replyToIssue(id: string, body: string): Promise<Res> {
  const staff = await requireAdmin("support");
  const text = String(body ?? "").trim();
  if (!uuid.test(id)) return fail("Invalid request.");
  if (text.length < 2 || text.length > 4000) return fail("Write a reply (up to 4,000 characters).");
  const sent = await sendSupportReply(id, text);
  if (!sent.ok) return fail(sent.error);
  await db().execute(sql`insert into issue_notes (issue_id, author_id, body, emailed_at) values (${id}, ${staff.id}, ${text}, now())`);
  await db().execute(sql`update issues set updated_at = now(), status = case when status = 'open' then 'investigating'::issue_status else status end where id = ${id}`);
  await audit(staff.id, "issue.reply", "issue", id);
  revalidatePath(`/issues/${id}`);
  return { ok: true };
}

/* ---------- Team ---------- */
const ownerMessage = "There must always be at least one owner.";
export async function addTeamMember(emailInput: string, role: string = "support"): Promise<Res> {
  const staff = await requireAdmin("team");
  const email = emailInput.trim().toLowerCase();
  if (!isEmail(email)) return fail("Enter a valid email address.");
  if (!isStaffRole(role)) return fail("Choose a role.");
  const u = (await db().execute(sql`select id, name from users where lower(email) = ${email}`)).rows[0] as { id: string; name: string } | undefined;
  if (!u) return fail("No account has that email yet. They need to sign in to the Rallix club app once first, then you can add them.");
  await db().execute(sql`insert into platform_admins (user_id, role) values (${u.id}, ${role}) on conflict do nothing`);
  await audit(staff.id, "team.add", "user", u.id, { name: u.name, role });
  revalidatePath("/team");
  return { ok: true };
}
/** Change someone's role. Only owners reach this; the database refuses to demote the last owner. */
export async function setTeamRole(userId: string, role: string): Promise<Res> {
  const staff = await requireAdmin("team");
  if (!/^[\w-]{1,64}$/.test(userId) || !isStaffRole(role)) return fail("Invalid request."); // user ids are random strings, not UUIDs
  try {
    const r = await db().execute(sql`update platform_admins set role = ${role} where user_id = ${userId} returning user_id`);
    if (!r.rows.length) return fail("That person is not on the team.");
  } catch (e) {
    if (pgCode(e) === "23514") return fail(ownerMessage);
    throw e;
  }
  await audit(staff.id, "team.role", "user", userId, { role });
  revalidatePath("/team");
  return { ok: true };
}
export async function removeTeamMember(userId: string): Promise<Res> {
  const staff = await requireAdmin("team");
  if (userId === staff.id) return fail("You can’t remove yourself.");
  try {
    const r = await db().execute(sql`delete from platform_admins where user_id = ${userId} returning user_id`);
    if (!r.rows.length) return fail("That person is not on the team.");
  } catch (e) {
    if (pgCode(e) === "23514") return fail(ownerMessage);
    throw e;
  }
  // Existing sessions are left alone on purpose: every request re-checks the platform_admins list, so removal is immediate.
  await audit(staff.id, "team.remove", "user", userId);
  revalidatePath("/team");
  return { ok: true };
}

/* ---------- Pay links ---------- */
/** Get (creating if needed) the public pay link for an issued invoice. */
export async function ensurePayLink(invoiceId: string): Promise<Res<{ url: string }>> {
  const staff = await requireAdmin("billing");
  if (!uuid.test(invoiceId)) return fail("Invalid request.");
  const r = await db().execute(sql`update platform_invoices set pay_token = coalesce(pay_token, ${newPayToken()}), pay_token_revoked_at = null where id = ${invoiceId} and status = 'issued' returning pay_token, number`);
  const row = r.rows[0] as { pay_token: string; number: string } | undefined;
  if (!row) return fail("Only issued invoices can have a pay link.");
  await audit(staff.id, "invoice.paylink_view", "invoice", invoiceId, { number: row.number });
  return { ok: true, url: payLinkUrl(row.pay_token) };
}
/** Replace the link: the old one stops working immediately. */
export async function replacePayLink(invoiceId: string): Promise<Res<{ url: string }>> {
  const staff = await requireAdmin("billing");
  if (!uuid.test(invoiceId)) return fail("Invalid request.");
  const r = await db().execute(sql`update platform_invoices set pay_token = ${newPayToken()}, pay_token_revoked_at = null where id = ${invoiceId} and status = 'issued' returning pay_token, number`);
  const row = r.rows[0] as { pay_token: string; number: string } | undefined;
  if (!row) return fail("Only issued invoices can have a pay link.");
  await audit(staff.id, "invoice.paylink_replace", "invoice", invoiceId, { number: row.number });
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true, url: payLinkUrl(row.pay_token) };
}
/** Turn the link off without replacing it. */
export async function disablePayLink(invoiceId: string): Promise<Res> {
  const staff = await requireAdmin("billing");
  if (!uuid.test(invoiceId)) return fail("Invalid request.");
  const r = await db().execute(sql`update platform_invoices set pay_token = null, pay_token_revoked_at = now() where id = ${invoiceId} returning number`);
  if (!r.rows.length) return fail("Invoice not found.");
  await audit(staff.id, "invoice.paylink_disable", "invoice", invoiceId, { number: (r.rows[0] as { number: string }).number });
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

/* ---------- Email ---------- */
/** Email an issued invoice (or a past-due reminder) to the club's admins. Asks for confirmation before sending twice within 24 hours. */
export async function emailInvoice(invoiceId: string, kind: "invoice" | "reminder", force = false): Promise<{ ok: true; sent: number; failed: number; recipients: number } | { ok: false; error: string; needsConfirm?: true }> {
  const staff = await requireAdmin("billing");
  if (!uuid.test(invoiceId) || !["invoice", "reminder"].includes(kind)) return fail("Invalid request.");
  const r = await sendInvoiceEmails(invoiceId, kind, force);
  if ("error" in r) return { ok: false, error: r.error, needsConfirm: r.needsConfirm };
  await audit(staff.id, `invoice.email_${kind}`, "invoice", invoiceId, { sent: r.sent, failed: r.failed });
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true, ...r };
}

/** Send the next batch (up to 100) of an email broadcast. Safe to click repeatedly. */
export async function continueNotification(id: string): Promise<Res<{ sent: number; failed: number; remaining: number }>> {
  const staff = await requireAdmin("notifications");
  if (!uuid.test(id)) return fail("Invalid request.");
  const r = await deliverNotification(id, 100);
  if ("error" in r) return fail(r.error);
  await audit(staff.id, "notification.send_batch", "notification", id, r);
  revalidatePath("/notifications");
  return { ok: true, ...r };
}

/** Put failed deliveries back in the queue so the next send retries them. */
export async function retryFailedDeliveries(id: string): Promise<Res<{ requeued: number }>> {
  const staff = await requireAdmin("notifications");
  if (!uuid.test(id)) return fail("Invalid request.");
  const r = await db().execute(sql`update notification_deliveries set status = 'pending', error = null, sent_at = null where notification_id = ${id} and status = 'failed' returning id`);
  await db().execute(sql`update notifications set status = 'queued' where id = ${id} and ${r.rows.length > 0}`);
  await audit(staff.id, "notification.retry_failed", "notification", id, { requeued: r.rows.length });
  revalidatePath("/notifications");
  return { ok: true, requeued: r.rows.length };
}

/* ---------- Dues reminders ---------- */
/** Run the club app's daily reminder job now. It is the same code the scheduler calls, and safe to repeat. */
export async function runRemindersJob(): Promise<Res<{ sent: number; failed: number }>> {
  const staff = await requireAdmin("billing");
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return fail("CRON_SECRET is not set for the console, so it can't call the job.");
  try {
    const res = await fetch(`${clubAppUrl()}/api/jobs/dues-reminders`, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(110_000) });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; sent?: number; failed?: number; error?: string } | null;
    if (!res.ok || !body?.ok) return fail(body?.error ?? `The job returned ${res.status}.`);
    await audit(staff.id, "reminders.run_manual", "reminders", null, { sent: body.sent, failed: body.failed });
    revalidatePath("/payments");
    return { ok: true, sent: body.sent ?? 0, failed: body.failed ?? 0 };
  } catch { return fail("Couldn't reach the club app. Check CLUB_APP_URL and that it is running."); }
}
