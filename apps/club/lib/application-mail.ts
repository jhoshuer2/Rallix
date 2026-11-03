import { and, eq, sql } from "drizzle-orm";
import { clubs, membershipApplications, memberships, users } from "@rallix/db";
import { compose } from "@rallix/mailer";
import { serviceDb } from "./db";
import { logEmail, mailer } from "./mail";
import { appUrl } from "./payments";

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

async function send(to: string, subject: string, body: string, vars: Record<string, string>, relatedId: string) {
  try {
    const m = compose({ subject, body, vars, footer: "You are receiving this because of activity on your Rallix club." });
    const r = await mailer().send({ to, subject: m.subject, text: m.text, html: m.html });
    await logEmail({ to, kind: "application", ok: r.ok, error: r.ok ? undefined : r.error, relatedId });
  } catch (e) {
    await logEmail({ to, kind: "application", ok: false, error: (e as Error).message, relatedId });
  }
}

/** Tell every active admin of the club that someone applied. Best effort: a failed email never fails the application. */
export async function notifyAdminsOfApplication(applicationId: string) {
  const db = serviceDb();
  const [a] = await db.select({ clubId: membershipApplications.clubId, name: membershipApplications.name, level: membershipApplications.level, message: membershipApplications.message, club: clubs.name })
    .from(membershipApplications).innerJoin(clubs, eq(clubs.id, membershipApplications.clubId)).where(eq(membershipApplications.id, applicationId));
  if (!a) return;
  const admins = await db.select({ email: users.email }).from(memberships).innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.clubId, a.clubId), eq(memberships.status, "active"), sql`'admin' = ANY(${memberships.roles})`));
  const vars = { name: oneLine(a.name), club: oneLine(a.club), level: a.level, message: a.message ? oneLine(a.message) : "(no message)", link: `${appUrl()}/members` };
  for (const e of new Set(admins.map((x) => x.email))) {
    await send(e, "New application to join {{club}}", "{{name}} would like to join {{club}}.\n\nLevel: {{level}}\nMessage: {{message}}\n\nReview the application in Rallix: {{link}}", vars, applicationId);
  }
}

/** Tell the applicant the decision. */
export async function notifyApplicant(applicationId: string) {
  const [a] = await serviceDb().select({ status: membershipApplications.status, note: membershipApplications.decisionNote, email: users.email, club: clubs.name })
    .from(membershipApplications).innerJoin(users, eq(users.id, membershipApplications.userId)).innerJoin(clubs, eq(clubs.id, membershipApplications.clubId)).where(eq(membershipApplications.id, applicationId));
  if (!a || (a.status !== "approved" && a.status !== "declined")) return;
  const vars = { club: oneLine(a.club), note: a.note ? ` Message from the club: ${oneLine(a.note)}` : "", link: `${appUrl()}/play` };
  if (a.status === "approved") await send(a.email, "Welcome to {{club}}", "Good news: {{club}} approved your application.{{note}}\n\nOpen Rallix to see the club: {{link}}", vars, applicationId);
  else await send(a.email, "Your application to {{club}}", "{{club}} could not accept your application this time.{{note}}", vars, applicationId);
}
