import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { emailLog } from "@rallix/db";
import { createMailer, otpMessage, type Mailer } from "@rallix/mailer";
import { serviceDb } from "./db";

const g = globalThis as unknown as { __rallixMail?: Mailer };
/** The configured mailer. Throws at first use in production if SMTP is not configured. */
export const mailer = (): Mailer => (g.__rallixMail ??= createMailer(process.env));

/** Record that we tried to send. Never stores the message or the code. Logging must never break sending. */
export async function logEmail(e: { to: string; kind: "otp" | "invoice" | "reminder" | "broadcast" | "application"; ok: boolean; error?: string; templateKey?: string; relatedId?: string }) {
  try { await serviceDb().insert(emailLog).values({ toEmail: e.to.toLowerCase(), kind: e.kind, status: e.ok ? "sent" : "failed", error: e.error?.slice(0, 300), templateKey: e.templateKey, relatedId: e.relatedId }); } catch { /* ignore */ }
}

const MAX_CODES_PER_10_MIN = 5;

/**
 * Send a sign-in code. Called from Better Auth, which may run it in the background, so this NEVER throws:
 * failures are logged and the user simply doesn't receive a code (the sign-in page tells them to wait and retry).
 * Limits how many codes one address can be sent, so the form can't be used to flood someone's inbox.
 */
export async function sendSignInCode(email: string, code: string): Promise<void> {
  try {
    const [row] = await serviceDb().select({ n: sql<number>`count(*)::int` }).from(emailLog)
      .where(and(eq(emailLog.toEmail, email.toLowerCase()), eq(emailLog.kind, "otp"), or(isNull(emailLog.error), ne(emailLog.error, "rate_limited")), gt(emailLog.createdAt, new Date(Date.now() - 10 * 60_000))));
    if ((row?.n ?? 0) >= MAX_CODES_PER_10_MIN) { await logEmail({ to: email, kind: "otp", ok: false, error: "rate_limited" }); return; }
    const m = otpMessage(code);
    const r = await mailer().send({ to: email, ...m });
    await logEmail({ to: email, kind: "otp", ok: r.ok, error: r.ok ? undefined : r.error });
  } catch (e) {
    await logEmail({ to: email, kind: "otp", ok: false, error: (e as Error).message });
  }
}
