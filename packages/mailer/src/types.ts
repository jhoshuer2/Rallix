export type Message = {
  to: string;
  subject: string;
  /** Plain-text body (always sent, so every client and spam filter has a text part). */
  text: string;
  html?: string;
  /** For optional mail (reminders, announcements). Adds List-Unsubscribe headers so Gmail and Outlook show their own Unsubscribe button. */
  unsubscribeUrl?: string;
};
export type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };

export interface Mailer {
  readonly name: "smtp" | "console";
  send(message: Message): Promise<SendResult>;
}

export class MailError extends Error {
  constructor(message: string, readonly code: "invalid_input" | "config" = "invalid_input") {
    super(message);
    this.name = "MailError";
  }
}
export const isMailError = (e: unknown): e is MailError =>
  e instanceof MailError || (typeof e === "object" && e !== null && (e as { name?: unknown }).name === "MailError");
