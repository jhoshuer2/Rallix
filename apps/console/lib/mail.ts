import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { emailLog } from "@rallix/db";
import { createMailer, otpMessage, type Mailer } from "@rallix/mailer";
import { db } from "./db";

const g = globalThis as unknown as { __consoleMail?: Mailer };
/** The configured mailer. Throws at first use in production if SMTP is not configured. */
export const mailer = (): Mailer => (g.__consoleMail ??= createMailer(process.env));

/** Record that we tried to send. Never stores the message or any code. Logging must never break sending. */
export async function logEmail(e: { to: string; kind: "otp" | "invoice" | "reminder" | "broadcast" | "support"; ok: boolean; error?: string; templateKey?: string; relatedId?: string }) {
  try { await db().insert(emailLog).values({ toEmail: e.to.toLowerCase(), kind: e.kind, status: e.ok ? "sent" : "failed", error: e.error?.slice(0, 300), templateKey: e.templateKey, relatedId: e.relatedId }); } catch { /* ignore */ }
}

/** Staff sign-in code. Never throws (Better Auth may run it in the background) and caps codes per address. */
export async function sendStaffCode(email: string, code: string): Promise<void> {
  try {
    const [row] = await db().select({ n: sql<number>`count(*)::int` }).from(emailLog)
      .where(and(eq(emailLog.toEmail, email.toLowerCase()), eq(emailLog.kind, "otp"), or(isNull(emailLog.error), ne(emailLog.error, "rate_limited")), gt(emailLog.createdAt, new Date(Date.now() - 10 * 60_000))));
    if ((row?.n ?? 0) >= 5) { await logEmail({ to: email, kind: "otp", ok: false, error: "rate_limited" }); return; }
    const r = await mailer().send({ to: email, ...otpMessage(code, "Rallix Console") });
    await logEmail({ to: email, kind: "otp", ok: r.ok, error: r.ok ? undefined : r.error });
  } catch (e) { await logEmail({ to: email, kind: "otp", ok: false, error: (e as Error).message }); }
}
