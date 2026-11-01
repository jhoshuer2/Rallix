import nodemailer, { type Transporter } from "nodemailer";
import { assertEmail, assertHeaderSafe, assertUrl } from "./safe";
import { MailError, type Mailer, type Message, type SendResult } from "./types";

export type SmtpOptions = { url: string; from: string; replyTo?: string; transport?: Transporter };

/** Real email over SMTP. One `smtp://` or `smtps://user:pass@host:port` URL works with any provider. */
export class SmtpMailer implements Mailer {
  readonly name = "smtp" as const;
  private readonly t: Transporter;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(opts: SmtpOptions) {
    if (!opts.from) throw new MailError("MAIL_FROM is not set", "config");
    this.from = assertHeaderSafe(opts.from, "MAIL_FROM");
    this.replyTo = opts.replyTo ? assertHeaderSafe(opts.replyTo, "MAIL_REPLY_TO") : undefined;
    if (!opts.transport && !/^smtps?:\/\//.test(opts.url)) throw new MailError("SMTP_URL must start with smtp:// or smtps://", "config");
    this.t = opts.transport ?? nodemailer.createTransport(opts.url, { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  }

  async send(m: Message): Promise<SendResult> {
    try {
      const info = await this.t.sendMail({
        from: this.from, replyTo: this.replyTo, to: assertEmail(m.to), subject: assertHeaderSafe(m.subject, "Subject"),
        text: m.text, ...(m.html ? { html: m.html } : {}),
        headers: {
          "X-Auto-Response-Suppress": "OOF, AutoReply",
          // RFC 8058 one-click unsubscribe: the mailbox provider POSTs to this URL, no page visit needed.
          ...(m.unsubscribeUrl ? { "List-Unsubscribe": `<${assertUrl(m.unsubscribeUrl)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {}),
        },
      });
      return { ok: true, messageId: info.messageId ?? null };
    } catch (e) {
      // Never leak server details or credentials into logs shown to users.
      const x = e as { responseCode?: number; code?: string };
      // Only the nodemailer error code (e.g. ECONNECTION, EENVELOPE) and numeric SMTP status are added: enough to tell a
      // refused sender/recipient from a bad port, without the server's reply text or the URL.
      const hint = [/^[A-Z_]{3,20}$/.test(x.code ?? "") ? x.code : "", typeof x.responseCode === "number" ? String(x.responseCode) : ""].filter(Boolean).join(" ");
      const msg = e instanceof MailError ? e.message : x.code === "EAUTH" ? "The mail server rejected our login" : `The mail server could not deliver the message${hint ? ` (${hint})` : ""}`;
      return { ok: false, error: msg };
    }
  }
}
