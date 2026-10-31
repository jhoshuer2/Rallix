import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";

type Row = Record<string, unknown>;
const q = async <T = Row>(query: SQL): Promise<T[]> => (await db().execute(query)).rows as T[];
const one = async <T = Row>(query: SQL): Promise<T | null> => (await q<T>(query))[0] ?? null;

export type Overview = {
  clubs_total: number; clubs_active: number; clubs_suspended: number; members: number; users: number; new_users_7d: number; active_users_7d: number;
  matches_30d: number; mrr: string; collected_30d: string; outstanding: string; past_due: number; open_issues: number; critical_issues: number;
};
export async function overview() {
  const o = (await one<Overview>(sql`select
    (select count(*)::int from clubs) clubs_total,
    (select count(*)::int from clubs where status = 'active') clubs_active,
    (select count(*)::int from clubs where status <> 'active') clubs_suspended,
    (select count(*)::int from memberships where status = 'active') members,
    (select count(*)::int from users) users,
    (select count(*)::int from users where created_at > now() - interval '7 days') new_users_7d,
    (select count(distinct user_id)::int from sessions where updated_at > now() - interval '7 days') active_users_7d,
    (select count(*)::int from matches where confirmed_at > now() - interval '30 days') matches_30d,
    (select coalesce(sum(case period when 'monthly' then amount_kobo else amount_kobo / 12 end), 0)::bigint from club_subscriptions where status = 'active') mrr,
    (select coalesce(sum(amount_kobo), 0)::bigint from platform_invoices where status = 'paid' and paid_at > now() - interval '30 days') collected_30d,
    (select coalesce(sum(amount_kobo), 0)::bigint from platform_invoices where status = 'issued') outstanding,
    (select count(*)::int from club_subscriptions where status = 'past_due') past_due,
    (select count(*)::int from issues where status in ('open','investigating')) open_issues,
    (select count(*)::int from issues where status in ('open','investigating') and severity = 'critical') critical_issues`))!;
  const series = (table: string, col: string) => q<{ label: string; value: number }>(sql.raw(`select to_char(d, 'DD Mon') as label, coalesce(c, 0)::int as value
    from generate_series(current_date - 29, current_date, interval '1 day') d
    left join (select ${col}::date as day, count(*) c from ${table} where ${col} > current_date - 30 group by 1) x on x.day = d::date order by d`));
  return { o, signups: await series("users", "created_at"), matches: await series("matches", "confirmed_at") };
}

export type ClubRow = {
  id: string; slug: string; name: string; location: string | null; status: "active" | "suspended" | "closed"; created_at: Date;
  owner_name: string; owner_phone: string | null; members: number; matches_30d: number; last_activity: Date | null; sub_status: string | null;
};
export async function listClubs(f: { q?: string; status?: string }) {
  const term = f.q?.trim() ? `%${f.q.trim()}%` : null;
  const status = ["active", "suspended", "closed"].includes(f.status ?? "") ? f.status! : null;
  return q<ClubRow>(sql`select c.id, c.slug, c.name, c.location, c.status, c.created_at, u.name as owner_name, u.phone_number as owner_phone,
      (select count(*)::int from memberships m where m.club_id = c.id and m.status = 'active') as members,
      (select count(*)::int from matches mt where mt.club_id = c.id and mt.confirmed_at > now() - interval '30 days') as matches_30d,
      (select max(mt.updated_at) from matches mt where mt.club_id = c.id) as last_activity,
      (select s.status from club_subscriptions s where s.club_id = c.id order by s.created_at desc limit 1) as sub_status
    from clubs c join users u on u.id = c.owner_id
    where (${term}::text is null or c.name ilike ${term} or c.slug ilike ${term} or u.name ilike ${term} or u.phone_number ilike ${term})
      and (${status}::text is null or c.status::text = ${status})
    order by c.created_at desc limit 300`);
}

/** Plain-language health for a club. Order matters: the first matching rule wins. */
export function health(c: Pick<ClubRow, "status" | "members" | "matches_30d" | "sub_status" | "created_at">): { label: string; tone: "ok" | "warn" | "bad" | undefined } {
  if (c.status !== "active") return { label: c.status === "suspended" ? "Suspended" : "Closed", tone: "bad" };
  if (c.sub_status === "past_due") return { label: "Payment overdue", tone: "bad" };
  const ageDays = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
  if (c.matches_30d > 0) return { label: "Active", tone: "ok" };
  if (ageDays < 14) return { label: "New", tone: undefined };
  return { label: c.members > 1 ? "Quiet (no matches in 30 days)" : "Inactive", tone: "warn" };
}

export async function getClub(id: string) {
  const club = await one<ClubRow & { timezone: string; owner_id: string; owner_email: string | null }>(sql`select c.id, c.slug, c.name, c.location, c.status, c.created_at, c.timezone, c.owner_id,
      u.name as owner_name, u.phone_number as owner_phone, u.email as owner_email,
      (select count(*)::int from memberships m where m.club_id = c.id and m.status = 'active') as members,
      (select count(*)::int from matches mt where mt.club_id = c.id and mt.confirmed_at > now() - interval '30 days') as matches_30d,
      (select max(mt.updated_at) from matches mt where mt.club_id = c.id) as last_activity,
      (select s.status from club_subscriptions s where s.club_id = c.id order by s.created_at desc limit 1) as sub_status
    from clubs c join users u on u.id = c.owner_id where c.id = ${id}`);
  if (!club) return null;
  const [totals, subs, invoices, issues, roles] = await Promise.all([
    one<{ competitions: number; matches: number; players: number; dues_open: number; dues_paid_kobo: string }>(sql`select
      (select count(*)::int from competitions where club_id = ${id}) competitions,
      (select count(*)::int from matches where club_id = ${id} and status = 'completed') matches,
      (select count(*)::int from memberships where club_id = ${id} and status = 'active' and 'player' = any(roles)) players,
      (select count(*)::int from dues where club_id = ${id} and status in ('due','overdue')) dues_open,
      (select coalesce(sum(amount_kobo),0)::bigint from payments where club_id = ${id} and status = 'paid') dues_paid_kobo`),
    q<{ id: string; period: string; status: string; amount_kobo: number; current_period_end: Date | null; created_at: Date }>(sql`select id, period, status, amount_kobo, current_period_end, created_at from club_subscriptions where club_id = ${id} order by created_at desc`),
    q<{ id: string; number: string; status: string; amount_kobo: number; period_label: string; issued_at: Date | null }>(sql`select id, number, status, amount_kobo, period_label, issued_at from platform_invoices where club_id = ${id} order by created_at desc limit 20`),
    q<{ id: string; title: string; severity: string; status: string; created_at: Date }>(sql`select id, title, severity, status, created_at from issues where club_id = ${id} order by created_at desc limit 10`),
    q<{ name: string; roles: string[] }>(sql`select u.name, m.roles::text[] as roles from memberships m join users u on u.id = m.user_id where m.club_id = ${id} and m.status = 'active' and ('admin' = any(m.roles) or 'scorer' = any(m.roles)) order by u.name`),
  ]);
  return { club, totals: totals!, subs, invoices, issues, staff: roles };
}

export async function listSubscriptions() {
  return q<{ id: string; club_id: string; club_name: string; club_status: string; period: string; status: string; amount_kobo: number; current_period_end: Date | null; created_at: Date }>(
    sql`select s.id, s.club_id, c.name as club_name, c.status as club_status, s.period, s.status, s.amount_kobo, s.current_period_end, s.created_at
        from club_subscriptions s join clubs c on c.id = s.club_id order by (s.status = 'past_due') desc, c.name`);
}
export async function clubsWithoutSubscription() {
  return q<{ id: string; name: string }>(sql`select c.id, c.name from clubs c where c.status = 'active' and not exists (select 1 from club_subscriptions s where s.club_id = c.id) order by c.name`);
}

export async function listInvoices(status?: string) {
  const st = ["draft", "issued", "paid", "void"].includes(status ?? "") ? status! : null;
  return q<{ id: string; number: string; club_id: string; club_name: string; status: string; amount_kobo: number; period_label: string; issued_at: Date | null; due_at: Date | null; paid_at: Date | null }>(
    sql`select i.id, i.number, i.club_id, c.name as club_name, i.status, i.amount_kobo, i.period_label, i.issued_at, i.due_at, i.paid_at
        from platform_invoices i join clubs c on c.id = i.club_id where (${st}::text is null or i.status::text = ${st}) order by i.created_at desc limit 300`);
}
export async function getInvoice(id: string) {
  const inv = await one<{ id: string; number: string; status: string; amount_kobo: number; period_label: string; description: string | null; issued_at: Date | null; due_at: Date | null; paid_at: Date | null; payment_ref: string | null; created_at: Date; club_id: string; club_name: string; club_location: string | null; owner_name: string; owner_phone: string | null; owner_email: string | null }>(
    sql`select i.id, i.number, i.status, i.amount_kobo, i.period_label, i.description, i.issued_at, i.due_at, i.paid_at, i.payment_ref, i.created_at, c.id as club_id, c.name as club_name, c.location as club_location,
        u.name as owner_name, u.phone_number as owner_phone, u.email as owner_email
        from platform_invoices i join clubs c on c.id = i.club_id join users u on u.id = c.owner_id where i.id = ${id}`);
  if (!inv) return null;
  return { inv, settings: (await one<{ company_name: string; address: string; email: string; phone: string; vat_percent: number; footer_note: string; payment_instructions: string }>(sql`select company_name, address, email, phone, vat_percent, footer_note, payment_instructions from platform_settings where id = 1`))! };
}

export const listTemplates = () => q<{ id: string; key: string; kind: string; name: string; subject: string | null; body: string; updated_at: Date }>(sql`select id, key, kind, name, subject, body, updated_at from templates order by kind, name`);
export const getSettings = () => one<{ company_name: string; address: string; email: string; phone: string; invoice_prefix: string; invoice_next: number; vat_percent: number; footer_note: string; payment_instructions: string }>(sql`select * from platform_settings where id = 1`);

export async function listIssues(f: { status?: string; severity?: string }) {
  const status = f.status === "all" ? null : f.status === "closed" ? "closed" : ["open", "investigating", "resolved"].includes(f.status ?? "") ? f.status! : "active";
  const sev = ["low", "normal", "high", "critical"].includes(f.severity ?? "") ? f.severity! : null;
  return q<{ id: string; title: string; severity: string; status: string; club_name: string | null; assignee: string | null; created_at: Date; updated_at: Date }>(
    sql`select i.id, i.title, i.severity, i.status, c.name as club_name, a.name as assignee, i.created_at, i.updated_at
        from issues i left join clubs c on c.id = i.club_id left join users a on a.id = i.assigned_to
        where (${status}::text is null or (${status} = 'active' and i.status in ('open','investigating')) or i.status::text = ${status})
          and (${sev}::text is null or i.severity::text = ${sev})
        order by (i.status in ('open','investigating')) desc, case i.severity when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, i.created_at desc limit 300`);
}
export async function getIssue(id: string) {
  const issue = await one<{ id: string; title: string; body: string | null; severity: string; status: string; club_id: string | null; club_name: string | null; reporter: string | null; assigned_to: string | null; created_at: Date; resolved_at: Date | null }>(
    sql`select i.id, i.title, i.body, i.severity, i.status, i.club_id, c.name as club_name, r.name as reporter, i.assigned_to, i.created_at, i.resolved_at
        from issues i left join clubs c on c.id = i.club_id left join users r on r.id = i.reported_by where i.id = ${id}`);
  if (!issue) return null;
  const notes = await q<{ id: string; body: string; author: string | null; created_at: Date }>(sql`select n.id, n.body, u.name as author, n.created_at from issue_notes n left join users u on u.id = n.author_id where n.issue_id = ${id} order by n.created_at`);
  return { issue, notes };
}

export const listNotifications = () => q<{ id: string; title: string; body: string; channel: string; status: string; recipient_count: number; audience: { type?: string; clubIds?: string[] }; created_at: Date; author: string | null }>(
  sql`select n.id, n.title, n.body, n.channel, n.status, n.recipient_count, n.audience, n.created_at, u.name as author from notifications n left join users u on u.id = n.created_by order by n.created_at desc limit 50`);
export const clubOptions = () => q<{ id: string; name: string }>(sql`select id, name from clubs order by name`);

export async function listAudit(f: { action?: string }) {
  const a = f.action?.trim() ? `${f.action.trim()}%` : null;
  return q<{ id: string; actor: string | null; action: string; entity: string | null; entity_id: string | null; meta: unknown; at: Date }>(
    sql`select l.id, u.name as actor, l.action, l.entity, l.entity_id, l.meta, l.at from audit_log l left join users u on u.id = l.actor_id where (${a}::text is null or l.action ilike ${a}) order by l.at desc limit 200`);
}
export const listTeam = () => q<{ user_id: string; name: string; phone: string | null; created_at: Date }>(sql`select a.user_id, u.name, u.phone_number as phone, a.created_at from platform_admins a join users u on u.id = a.user_id order by u.name`);

/** Distinct people a broadcast would reach. Only active members of active clubs. */
export async function audienceCount(a: { type: "all_admins" | "all_players" | "clubs"; clubIds?: string[] }) {
  const roleFilter = a.type === "all_admins" ? sql`'admin' = any(m.roles)` : sql`true`;
  const clubFilter = a.type === "clubs" ? sql`and m.club_id = any(${a.clubIds ?? []}::uuid[])` : sql``;
  const r = await one<{ n: number }>(sql`select count(distinct m.user_id)::int as n from memberships m join clubs c on c.id = m.club_id where m.status = 'active' and c.status = 'active' and ${roleFilter} ${clubFilter}`);
  return r?.n ?? 0;
}
