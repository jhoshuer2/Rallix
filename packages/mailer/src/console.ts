import { assertEmail, assertHeaderSafe } from "./safe";
import type { Mailer, Message, SendResult } from "./types";

/** Development mailer: prints what would be sent. Never used in production. */
export class ConsoleMailer implements Mailer {
  readonly name = "console" as const;
  /** Addresses that fail on purpose, so failure handling can be tested. Comma separated. */
  constructor(private readonly failFor: string[] = []) {}

  async send(m: Message): Promise<SendResult> {
    try { assertEmail(m.to); assertHeaderSafe(m.subject, "Subject"); } catch (e) { return { ok: false, error: (e as Error).message }; }
    if (this.failFor.includes(m.to.trim().toLowerCase())) return { ok: false, error: "Simulated delivery failure" };
    console.log(`[mail:dev] to ${m.to.trim()} | ${m.subject}\n${m.text.split("\n").map((l) => `    ${l}`).join("\n")}`);
    return { ok: true, messageId: `dev-${Date.now()}` };
  }
}
