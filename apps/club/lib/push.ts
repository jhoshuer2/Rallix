import { appEnv, isProduction } from "@rallix/config/env";
import { inArray, sql } from "drizzle-orm";
import webpush from "web-push";
import { pushSubscriptions } from "@rallix/db";
import { serviceDb } from "./db";

export type PushPayload = { title: string; body: string; url: string };
type Sub = { endpoint: string; p256dh: string; auth: string };
export type PushSender = { name: "web" | "console"; send(userId: string, sub: Sub, payload: PushPayload): Promise<{ ok: boolean; gone?: boolean }> };

/** Dev and tests print to the server log (like the mail console); production needs real VAPID keys. */
export function createPushSender(env: Record<string, string | undefined>): PushSender {
  const prod = env.NODE_ENV === "production";
  const provider = env.PUSH_PROVIDER ?? (prod ? "web" : "console");
  if (provider === "console") {
    if (prod) throw new Error("PUSH_PROVIDER=console is not allowed in production.");
    return { name: "console", async send(userId, _sub, p) { console.log(`[push:dev] to ${userId} | ${p.title} | ${p.body}`); return { ok: true }; } };
  }
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = env;
  if (!pub || !priv || !subject) throw new Error("Push needs VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.");
  webpush.setVapidDetails(subject, pub, priv);
  return {
    name: "web",
    async send(_userId, s, p) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p), { TTL: 3600, urgency: "high" });
        return { ok: true };
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        return { ok: false, gone: code === 404 || code === 410 };
      }
    },
  };
}

const g = globalThis as unknown as { __rallixPush?: PushSender };
export const pusher = (): PushSender => (g.__rallixPush ??= createPushSender(appEnv()));

/** Send to every device of these users. NEVER throws: a failed alert must not fail the action that caused it. Dead subscriptions are removed. */
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  try {
    const db = serviceDb();
    const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
    const sender = pusher();
    let sent = 0, failed = 0;
    const gone: string[] = [], ok: string[] = [];
    await Promise.all(subs.map(async (s) => {
      const r = await sender.send(s.userId, s, payload);
      if (r.ok) { sent++; ok.push(s.id); } else { failed++; if (r.gone) gone.push(s.id); }
    }));
    if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    if (ok.length) await db.update(pushSubscriptions).set({ lastOkAt: sql`now()` }).where(inArray(pushSubscriptions.id, ok));
    return { sent, failed };
  } catch {
    return { sent: 0, failed: 0 };
  }
}
