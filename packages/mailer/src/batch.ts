import type { Mailer, Message, SendResult } from "./types";

export type BatchItem = { key: string; message: Message };
export type BatchOutcome = { key: string; result: SendResult };

/**
 * Send many messages with limited concurrency. Failures are collected per recipient and never stop the rest.
 * `limit` caps how many are attempted in this call (the caller resumes with the remainder).
 */
export async function sendBatch(mailer: Mailer, items: BatchItem[], opts: { concurrency?: number; limit?: number } = {}): Promise<BatchOutcome[]> {
  const todo = items.slice(0, opts.limit ?? items.length);
  const out: BatchOutcome[] = new Array(todo.length);
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const i = next++;
      const it = todo[i]!;
      try { out[i] = { key: it.key, result: await mailer.send(it.message) }; }
      catch (e) { out[i] = { key: it.key, result: { ok: false, error: (e as Error).message || "Unexpected error" } }; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 5, todo.length || 1)) }, worker));
  return out;
}
