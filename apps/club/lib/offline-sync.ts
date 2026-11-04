"use client";
import { classifyResult, dueItems, forceDue, prune, type OutboxItem, type SyncReply as QueueReply } from "@rallix/stats";
import { syncOfflineResult } from "./actions";
import { announceOutbox, deleteOutbox, listOutbox, putOutbox } from "./offline-store";

let running = false;

/** Send every waiting result. One run at a time per tab; the server is safe to call twice anyway (clientRef). */
export async function syncNow(opts: { force?: boolean } = {}): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    let items = await listOutbox();
    for (const old of items.filter((i) => !prune([i], now).length)) await deleteOutbox(old.clientRef);
    items = prune(items, now);
    if (opts.force) { items = forceDue(items, now); for (const i of items) await putOutbox(i); }
    for (const item of dueItems(items, now)) {
      await putOutbox({ ...item, state: "syncing", nextTryAt: Date.now() });
      announceOutbox();
      const reply = await send(item);
      await putOutbox(classifyResult(item, reply, Date.now()));
      announceOutbox();
      if (reply.kind === "network") break; // no signal: do not hammer the rest
    }
  } finally { running = false; announceOutbox(); }
}

async function send(item: OutboxItem & { clubId?: string }): Promise<QueueReply> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { kind: "network" };
  try {
    const r = await syncOfflineResult({ clubId: item.clubId ?? "", matchId: item.matchId, games: item.games, clientRef: item.clientRef });
    if (r.ok) return r.already ? { kind: "already_ours" } : { kind: "ok" };
    if (r.kind === "conflict") return { kind: "conflict", reason: r.error };
    if (r.kind === "auth") return { kind: "network" }; // signed out: keep it, retry once they sign in
    return { kind: "rejected", reason: r.error };
  } catch { return { kind: "network" }; }
}
