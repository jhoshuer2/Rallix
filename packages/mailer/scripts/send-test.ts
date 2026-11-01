/**
 * Send one real email with YOUR settings, to check them before launch.
 *
 *   MAIL_PROVIDER=smtp SMTP_URL='smtps://user:pass@smtp.yourprovider.com:465' MAIL_FROM='Rallix <no-reply@yourdomain.com>' \
 *     pnpm --filter @rallix/mailer send-test you@example.com
 *
 * Then check: did it arrive, is it in the inbox (not spam), and does "show original" say SPF, DKIM and DMARC = PASS?
 */
import { compose, createMailer, isEmail } from "../src";

const to = process.argv[2];
if (!to || !isEmail(to)) { console.error("Usage: send-test <your email address>"); process.exit(1); }
const mailer = createMailer({ ...process.env, NODE_ENV: process.env.NODE_ENV === "production" ? "production" : "development" });
const m = compose({ subject: "Rallix test email", body: "Hello,\n\nThis is a test from Rallix using the {{provider}} mailer.\n\nIf you can read this in your inbox, sign-in codes and invoices will reach people.", vars: { provider: mailer.name }, footer: "Test message. No action needed." });
const r = await mailer.send({ to, ...m });
console.log(r.ok ? `Sent via ${mailer.name} to ${to} (id ${r.messageId}). Now check it landed in the inbox, not spam.` : `FAILED: ${r.error}`);
process.exit(r.ok ? 0 : 1);
