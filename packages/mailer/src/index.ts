import { ConsoleMailer } from "./console";
import { SmtpMailer } from "./smtp";
import { MailError, type Mailer } from "./types";

export * from "./types";
export * from "./safe";
export * from "./template";
export * from "./batch";
export { SmtpMailer } from "./smtp";
export { ConsoleMailer } from "./console";

/**
 * Pick the mailer from the environment. Production must use SMTP: the console mailer would silently drop every email,
 * including sign-in codes.
 *   MAIL_PROVIDER=smtp|console (default: console outside production, smtp in production)
 *   SMTP_URL=smtps://user:pass@host:465   MAIL_FROM="Rallix <no-reply@yourdomain>"   MAIL_REPLY_TO=optional
 */
export function createMailer(env: Record<string, string | undefined>): Mailer {
  const production = env.NODE_ENV === "production";
  const choice = env.MAIL_PROVIDER ?? (production ? "smtp" : "console");
  if (choice === "console") {
    if (production) throw new MailError("MAIL_PROVIDER=console is not allowed in production", "config");
    return new ConsoleMailer((env.MAIL_FAIL_ADDRESSES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  }
  if (choice === "smtp") return new SmtpMailer({ url: env.SMTP_URL ?? "", from: env.MAIL_FROM ?? "", replyTo: env.MAIL_REPLY_TO });
  throw new MailError(`Unknown MAIL_PROVIDER "${choice}"`, "config");
}
