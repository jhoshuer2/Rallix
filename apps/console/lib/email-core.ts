import { sql } from "drizzle-orm";
import { assertHeaderSafe, compose, layout, renderHtml, sendBatch, signUnsubscribeToken } from "@rallix/mailer";
import { date, naira } from "./format";
import { db } from "./db";
import { logEmail, mailer } from "./mail";
import { clubAppUrl, newPayToken, payLinkUrl } from "./pay-link";

/** Same secret as the club app, which serves the unsubscribe page and verifies these links. */
function unsubscribeSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("UNSUBSCRIBE_SECRET is not set");
  return "dev-only-unsubscribe-secret-not-for-production";
}

type Row = Record<string, unknown>;
const rows = async <T = Row>(q: ReturnType<typeof sql>) => (await db().execute(q)).rows as T[];

export type InvoiceEmailResult = { sent: number; failed: number; recipients: number } | { error: string; needsConfirm?: true };

/**
 * Email an issued invoice (with its pay link) to the club's admins. Works even if the club is suspended, because those are
 * exactly the people who need to hear about it. A missing template value fails the whole send BEFORE anything goes out.
 */
export async function sendInvoiceEmails(invoiceId: string, kind: "invoice" | "reminder", force: boolean): Promise<InvoiceEmailResult> {
  const key = kind === "invoice" ? "invoice_issued" : "subscription_past_due";
  const [inv] = await rows<{ id: string; number: string; status: string; amount_kobo: number; period_label: string; due_at: Date | null; pay_token: string | null; club_id: string; club_name: string }>(
    sql`select i.id, i.number, i.status, i.amount_kobo, i.period_label, i.due_at, i.pay_token, c.id as club_id, c.name as club_name from platform_invoices i join clubs c on c.id = i.club_id where i.id = ${invoiceId}`);
  if (!inv) return { error: "Invoice not found." };
  if (inv.status !== "issued") return { error: "Only issued, unpaid invoices can be emailed." };

  const recent = (await rows<{ at: Date; n: number }>(sql`select max(created_at) as at, count(*)::int as n from email_log where related_id = ${invoiceId} and kind = ${kind} and status = 'sent' and created_at > now() - interval '24 hours'`))[0];
  if (recent && recent.n > 0 && !force) return { error: `This invoice was already emailed in the last 24 hours (${recent.n} message${recent.n === 1 ? "" : "s"}). Send again?`, needsConfirm: true };

  const [tpl] = await rows<{ subject: string | null; body: string }>(sql`select subject, body from templates where key = ${key}`);
  const [settings] = await rows<{ company_name: string; payment_instructions: string }>(sql`select company_name, payment_instructions from platform_settings where id = 1`);
  if (!tpl || !settings) return { error: "The email template or settings are missing." };

  let token = inv.pay_token;
  if (!token) { token = newPayToken(); await db().execute(sql`update platform_invoices set pay_token = coalesce(pay_token, ${token}) where id = ${inv.id}`); token = ((await rows<{ pay_token: string }>(sql`select pay_token from platform_invoices where id = ${inv.id}`))[0]!).pay_token; }

  const admins = await rows<{ name: string; email: string }>(sql`select distinct on (u.id) u.name, u.email from memberships m join users u on u.id = m.user_id where m.club_id = ${inv.club_id} and m.status = 'active' and 'admin' = any(m.roles) order by u.id`);
  if (!admins.length) return { error: "This club has no admins with an email address." };

  const items = [];
  try {
    for (const a of admins) {
      const m = compose({
        subject: tpl.subject ?? "Your Rallix invoice", body: tpl.body, company: settings.company_name,
        footer: `Sent by ${settings.company_name}. You received this because you are an admin of ${inv.club_name} on Rallix.`,
        vars: { admin_name: a.name.trim().split(/\s+/)[0] || "there", club_name: inv.club_name, invoice_number: inv.number, period: inv.period_label, amount: naira(inv.amount_kobo), due_date: date(inv.due_at), pay_link: payLinkUrl(token), payment_instructions: settings.payment_instructions || "You can pay online with the link above.", company_name: settings.company_name },
      });
      items.push({ key: a.email, message: { to: a.email, ...m } });
    }
  } catch (e) { return { error: `The template can't be filled in: ${(e as Error).message}. Fix it in Templates.` }; }

  const out = await sendBatch(mailer(), items, { concurrency: 3 });
  let sent = 0, failed = 0;
  for (const o of out) { o.result.ok ? sent++ : failed++; await logEmail({ to: o.key, kind, ok: o.result.ok, error: o.result.ok ? undefined : o.result.error, templateKey: key, relatedId: inv.id }); }
  return { sent, failed, recipients: admins.length };
}

/** Who a broadcast reaches: distinct people with an active membership in an active club. */
export async function createDeliveries(notificationId: string, a: { type: "all_admins" | "all_players" | "clubs"; clubIds: string[] }): Promise<number> {
  const roleFilter = a.type === "all_admins" ? sql`'admin' = any(m.roles)` : sql`true`;
  const clubFilter = a.type === "clubs" ? sql`and m.club_id::text in (${sql.join(a.clubIds.map((c) => sql`${c}`), sql`, `)})` : sql``;
  const r = await db().execute(sql`insert into notification_deliveries (notification_id, user_id, email)
    select distinct on (u.id) ${notificationId}::uuid, u.id, u.email from memberships m join clubs c on c.id = m.club_id join users u on u.id = m.user_id
    where m.status = 'active' and c.status = 'active' and ${roleFilter} ${a.type === 'all_admins' ? sql`` : sql`and not u.email_opt_out`} ${clubFilter} order by u.id on conflict do nothing returning id`);
  return r.rows.length;
}

/**
 * Send up to `limit` pending deliveries for one notification, then update its counts and status.
 * Rows are CLAIMED first (so two staff clicking at once can't double-send) and a claim older than 5 minutes is considered abandoned.
 * Broadcast bodies are plain text typed by staff: they are escaped, never treated as templates.
 */
export async function deliverNotification(id: string, limit = 100): Promise<{ sent: number; failed: number; remaining: number } | { error: string }> {
  const [n] = await rows<{ title: string; body: string; channel: string; audience: { type?: string } }>(sql`select title, body, channel::text as channel, audience from notifications where id = ${id}`);
  if (!n) return { error: "Notification not found." };
  if (n.channel !== "email") return { error: "Only the email channel can be sent for now." };
  let subject: string;
  try { subject = assertHeaderSafe(n.title.trim(), "Title"); } catch { return { error: "The title can't contain line breaks." }; }
  const [settings] = await rows<{ company_name: string }>(sql`select company_name from platform_settings where id = 1`);
  const company = settings?.company_name ?? "Rallix";

  const claimed = await rows<{ id: string; email: string; user_id: string }>(sql`update notification_deliveries set sent_at = now()
    where id in (select id from notification_deliveries where notification_id = ${id} and status = 'pending' and (sent_at is null or sent_at < now() - interval '5 minutes') order by id limit ${limit} for update skip locked)
    returning id, email, user_id`);
  // Messages to admins about the platform are operational. Anything that can reach players is optional mail and gets an unsubscribe link.
  const optional = n.audience?.type !== "all_admins";
  const baseFooter = `Sent by ${company}. You received this because you are a member of a club on Rallix.`;
  const out = await sendBatch(mailer(), claimed.map((c) => {
    let footer = baseFooter, unsubscribeUrl: string | undefined;
    if (optional) {
      const token = signUnsubscribeToken(unsubscribeSecret(), c.user_id);
      footer = `${baseFooter}\nDon't want these emails? Unsubscribe: ${clubAppUrl()}/unsubscribe/${token}`;
      unsubscribeUrl = `${clubAppUrl()}/api/unsubscribe/${token}`;
    }
    return { key: c.id, message: { to: c.email, subject, text: `${n.body}\n\n--\n${footer}`, html: layout({ title: subject, bodyHtml: renderHtml(n.body), footer, company }), unsubscribeUrl } };
  }), { concurrency: 4 });
  let sent = 0, failed = 0;
  for (const o of out) {
    const c = claimed.find((x) => x.id === o.key)!;
    if (o.result.ok) { sent++; await db().execute(sql`update notification_deliveries set status = 'sent', sent_at = now(), error = null where id = ${o.key}`); }
    else { failed++; await db().execute(sql`update notification_deliveries set status = 'failed', error = ${o.result.error.slice(0, 300)} where id = ${o.key}`); }
    await logEmail({ to: c.email, kind: "broadcast", ok: o.result.ok, error: o.result.ok ? undefined : o.result.error, relatedId: id });
  }
  const [t] = await rows<{ sent: number; failed: number; pending: number }>(sql`select count(*) filter (where status = 'sent')::int as sent, count(*) filter (where status = 'failed')::int as failed, count(*) filter (where status = 'pending')::int as pending from notification_deliveries where notification_id = ${id}`);
  const done = t!.pending === 0;
  await db().execute(sql`update notifications set sent_count = ${t!.sent}, failed_count = ${t!.failed},
    status = ${done ? (t!.sent === 0 && t!.failed > 0 ? "failed" : "sent") : "queued"}::notification_status, sent_at = case when ${done} then coalesce(sent_at, now()) else sent_at end where id = ${id}`);
  return { sent, failed, remaining: t!.pending };
}

/** Email a staff reply to whoever sent a support request from the club app. Operational mail, so it is sent even if they opted out of announcements. */
export async function sendSupportReply(issueId: string, reply: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [i] = await rows<{ title: string; email: string | null; name: string | null; club_name: string | null }>(sql`select i.title, u.email, u.name, c.name as club_name from issues i left join users u on u.id = i.reported_by left join clubs c on c.id = i.club_id where i.id = ${issueId} and i.source = 'club'`);
  if (!i) return { ok: false, error: "This request did not come from a club member." };
  if (!i.email) return { ok: false, error: "The person who sent it no longer has an account." };
  const one = (v: string) => v.replace(/[\r\n]+/g, " ").trim();
  try {
    const m = compose({ subject: "Re: {{title}}", body: "Hello {{name}},\n\n{{reply}}\n\nRallix support", vars: { title: one(i.title), name: one(i.name ?? "there"), reply: reply.trim() }, footer: `You are receiving this because you contacted Rallix support${i.club_name ? ` from ${one(i.club_name)}` : ""}. Reply to this email to continue.` });
    const r = await mailer().send({ to: i.email, subject: m.subject, text: m.text, html: m.html });
    await logEmail({ to: i.email, kind: "support", ok: r.ok, error: r.ok ? undefined : r.error, relatedId: issueId });
    return r.ok ? { ok: true } : { ok: false, error: "The email could not be sent. Try again." };
  } catch (e) {
    await logEmail({ to: i.email, kind: "support", ok: false, error: (e as Error).message, relatedId: issueId });
    return { ok: false, error: "The email could not be sent. Try again." };
  }
}

/** Tell a club's owner that Rallix approved or declined their new club. Best effort: the decision stands even if the email fails. */
export async function sendClubReview(clubId: string, outcome: "approved" | "declined", note?: string): Promise<void> {
  const [c] = await rows<{ name: string; email: string | null; owner: string }>(sql`select c.name, u.email, u.name as owner from clubs c join users u on u.id = c.owner_id where c.id = ${clubId}`);
  if (!c?.email) return;
  const one = (v: string) => v.replace(/[\r\n]+/g, " ").trim();
  const subject = outcome === "approved" ? "{{club}} is approved on Rallix" : "About your Rallix club {{club}}";
  const body = outcome === "approved"
    ? "Hello {{owner}},\n\nGood news: {{club}} is approved. You can sign in and start inviting players now: {{link}}\n\nRallix"
    : "Hello {{owner}},\n\nWe couldn’t approve {{club}} this time.{{note}}\n\nIf you think this is a mistake, reply to this email.\n\nRallix";
  try {
    const m = compose({ subject, body, vars: { club: one(c.name), owner: one(c.owner), link: clubAppUrl(), note: note ? ` Reason: ${one(note)}.` : "" }, footer: "You are receiving this because you created a club on Rallix." });
    const r = await mailer().send({ to: c.email, subject: m.subject, text: m.text, html: m.html });
    await logEmail({ to: c.email, kind: "club_review", ok: r.ok, error: r.ok ? undefined : r.error, relatedId: clubId });
  } catch (e) {
    await logEmail({ to: c.email, kind: "club_review", ok: false, error: (e as Error).message, relatedId: clubId });
  }
}
