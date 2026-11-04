"use client";
/**
 * Everything the phone keeps so a scorer can work without a signal: the match being scored (names, best-of) and the outbox of
 * finished results waiting to send. IndexedDB only; every call fails soft (private windows or blocked storage return nothing).
 */
import type { GameScore, OutboxItem } from "@rallix/stats";

export type MatchContext = {
  matchId: string; competitionId: string; clubId: string; bestOf: number; savedAt: number;
  p1: { id: string; name: string; photo: string | null; rank: number };
  p2: { id: string; name: string; photo: string | null; rank: number };
};
/** A half-played match, so a reload or a dropped tab does not lose the points. */
export type Draft = { matchId: string; done: GameScore[]; cur: [number, number]; savedAt: number };

const DB = "rallix-offline", VERSION = 1;

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("matches")) db.createObjectStore("matches", { keyPath: "matchId" });
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "clientRef" });
        if (!db.objectStoreNames.contains("drafts")) db.createObjectStore("drafts", { keyPath: "matchId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function run<T>(store: "matches" | "outbox" | "drafts", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<any> | null, fallback: T): Promise<T> {
  const db = await open();
  if (!db) return fallback;
  return new Promise<T>((resolve) => {
    try {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      let value: T = fallback;
      if (req) req.onsuccess = () => { value = req.result as T; };
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(fallback); };
    } catch { try { db.close(); } catch { /* ignore */ } resolve(fallback); }
  });
}

export const saveMatchContext = (c: MatchContext) => run<void>("matches", "readwrite", (s) => s.put(c), undefined as void);
export const getMatchContext = (id: string) => run<MatchContext | undefined>("matches", "readonly", (s) => s.get(id), undefined);
export const listOutbox = () => run<OutboxItem[]>("outbox", "readonly", (s) => s.getAll(), []);
export const putOutbox = (i: OutboxItem) => run<void>("outbox", "readwrite", (s) => s.put(i), undefined as void);
export const deleteOutbox = (ref: string) => run<void>("outbox", "readwrite", (s) => s.delete(ref), undefined as void);
export const saveDraft = (d: Draft) => run<void>("drafts", "readwrite", (s) => s.put(d), undefined as void);
export const getDraft = (id: string) => run<Draft | undefined>("drafts", "readonly", (s) => s.get(id), undefined);
export const deleteDraft = (id: string) => run<void>("drafts", "readwrite", (s) => s.delete(id), undefined as void);

/** Tell open tabs and the banner that the outbox changed. */
export function announceOutbox() { try { window.dispatchEvent(new Event("rallix-outbox")); } catch { /* ignore */ } }

export function newClientRef(): string {
  try { return crypto.randomUUID(); } catch { return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
}
