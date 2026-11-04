/**
 * Offline scoring outbox: pure rules, no I/O. A result entered without a network is kept on the phone
 * and sent later. These functions decide what each queued item is and when to try it again.
 */
import type { GameScore } from "./record";

export type OutboxState = "waiting" | "syncing" | "synced" | "conflict" | "failed";

export type OutboxItem = {
  /** Random id made on the phone. The server stores it, so a retry after a lost reply is recognised as ours. */
  clientRef: string;
  matchId: string;
  competitionId: string;
  /** The match's own club: the result is sent there whichever club is open in the app later. */
  clubId: string;
  /** Names for the banner, so a conflict can show who played. */
  label: string;
  games: GameScore[];
  state: OutboxState;
  attempts: number;
  createdAt: number;
  nextTryAt: number;
  /** Plain words for the scorer when something needs attention. */
  message?: string;
};

/** What the server said, reduced to what the queue needs to know. */
export type SyncReply =
  | { kind: "ok" } // saved now
  | { kind: "already_ours" } // saved earlier by this same item (reply was lost)
  | { kind: "conflict"; reason: string } // someone else recorded a different result
  | { kind: "rejected"; reason: string } // will never succeed (not allowed, invalid score)
  | { kind: "network" } // never reached the server, or the server was busy
  ;

export const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 15 * 60_000;

/** Seconds-scale backoff that doubles and stops at 15 minutes. */
export function backoffMs(attempts: number): number {
  const a = Math.max(0, Math.floor(attempts));
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** a);
}

export function newItem(input: { clientRef: string; matchId: string; competitionId: string; clubId: string; label: string; games: GameScore[] }, now: number): OutboxItem {
  return { ...input, state: "waiting", attempts: 0, createdAt: now, nextTryAt: now };
}

/** Apply a server reply to an item. */
export function classifyResult(item: OutboxItem, reply: SyncReply, now: number): OutboxItem {
  switch (reply.kind) {
    case "ok":
    case "already_ours":
      return { ...item, state: "synced", message: undefined };
    case "conflict":
      return { ...item, state: "conflict", message: reply.reason };
    case "rejected":
      return { ...item, state: "failed", message: reply.reason };
    case "network": {
      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) return { ...item, state: "failed", attempts, message: "Could not reach the server. Try again when you have a signal." };
      return { ...item, state: "waiting", attempts, nextTryAt: now + backoffMs(attempts), message: undefined };
    }
  }
}

/** Items to send now: waiting and due, oldest first. A syncing item that sat for over 2 minutes is treated as due (the tab closed mid-send). */
export function dueItems(items: OutboxItem[], now: number): OutboxItem[] {
  return items
    .filter((i) => (i.state === "waiting" && i.nextTryAt <= now) || (i.state === "syncing" && now - i.nextTryAt > 120_000))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** A person pressed "Send now": every waiting item is due immediately and failed ones get one more go. */
export function forceDue(items: OutboxItem[], now: number): OutboxItem[] {
  return items.map((i) => (i.state === "waiting" || i.state === "failed" ? { ...i, state: "waiting" as const, nextTryAt: now, attempts: i.state === "failed" ? 0 : i.attempts } : i));
}

/** Add an item unless one with the same clientRef or the same match is already queued (a match is only recorded once). */
export function enqueue(items: OutboxItem[], item: OutboxItem): OutboxItem[] {
  if (items.some((i) => i.clientRef === item.clientRef)) return items;
  if (items.some((i) => i.matchId === item.matchId && i.state !== "synced")) return items;
  return [...items, item];
}

export type OutboxSummary = { waiting: number; needsAttention: number; label: string | null };

/** The one line for the banner. Hidden (null) when there is nothing to say. */
export function summarize(items: OutboxItem[]): OutboxSummary {
  const waiting = items.filter((i) => i.state === "waiting" || i.state === "syncing").length;
  const needsAttention = items.filter((i) => i.state === "conflict" || i.state === "failed").length;
  const parts: string[] = [];
  if (waiting) parts.push(`${waiting} result${waiting === 1 ? "" : "s"} waiting to send`);
  if (needsAttention) parts.push(`${needsAttention} need${needsAttention === 1 ? "s" : ""} your attention`);
  return { waiting, needsAttention, label: parts.length ? parts.join(" · ") : null };
}

/** Synced items are dropped from the queue once they are a day old, so the list does not grow forever. */
export function prune(items: OutboxItem[], now: number): OutboxItem[] {
  return items.filter((i) => !(i.state === "synced" && now - i.createdAt > 24 * 3600_000));
}
