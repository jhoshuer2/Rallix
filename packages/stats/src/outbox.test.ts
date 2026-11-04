import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, backoffMs, classifyResult, dueItems, enqueue, forceDue, newItem, prune, summarize } from "./outbox";

const g = [{ p1: 11, p2: 5 }, { p1: 11, p2: 7 }, { p1: 11, p2: 9 }];
const mk = (ref: string, match = "m1", now = 1000) => newItem({ clientRef: ref, matchId: match, competitionId: "c1", clubId: "k1", label: "A v B", games: g }, now);

describe("outbox", () => {
  it("backoff doubles and is capped", () => {
    expect(backoffMs(0)).toBe(5000);
    expect(backoffMs(1)).toBe(10000);
    expect(backoffMs(2)).toBe(20000);
    expect(backoffMs(30)).toBe(15 * 60_000);
    expect(backoffMs(-3)).toBe(5000);
  });
  it("ok and already_ours both end as synced", () => {
    expect(classifyResult(mk("a"), { kind: "ok" }, 2000).state).toBe("synced");
    expect(classifyResult(mk("a"), { kind: "already_ours" }, 2000).state).toBe("synced");
  });
  it("conflict and rejected need attention and keep the reason", () => {
    const c = classifyResult(mk("a"), { kind: "conflict", reason: "Already recorded" }, 2000);
    expect(c.state).toBe("conflict"); expect(c.message).toBe("Already recorded");
    expect(classifyResult(mk("a"), { kind: "rejected", reason: "No" }, 2000).state).toBe("failed");
  });
  it("network errors back off, then fail after the limit", () => {
    let i = mk("a");
    i = classifyResult(i, { kind: "network" }, 10_000);
    expect(i.state).toBe("waiting"); expect(i.attempts).toBe(1); expect(i.nextTryAt).toBe(10_000 + backoffMs(1));
    for (let n = 1; n < MAX_ATTEMPTS; n++) i = classifyResult(i, { kind: "network" }, 10_000);
    expect(i.state).toBe("failed");
  });
  it("dueItems returns waiting items that are due, oldest first, and stale syncing ones", () => {
    const a = { ...mk("a", "m1", 100), nextTryAt: 500 };
    const b = { ...mk("b", "m2", 50), nextTryAt: 100 };
    const c = { ...mk("c", "m3", 10), nextTryAt: 900_000 };
    const s = { ...mk("s", "m4", 5), state: "syncing" as const, nextTryAt: 0 };
    expect(dueItems([a, b, c, s], 200_000).map((i) => i.clientRef)).toEqual(["s", "b", "a"]);
    expect(dueItems([{ ...s, nextTryAt: 999_000 }], 1_000_000)).toEqual([]);
  });
  it("forceDue makes waiting and failed items due and resets failed attempts", () => {
    const w = { ...mk("w", "m1"), nextTryAt: 99_999, attempts: 3 };
    const f = { ...mk("f", "m2"), state: "failed" as const, attempts: 8 };
    const k = { ...mk("k", "m3"), state: "conflict" as const };
    const out = forceDue([w, f, k], 5000);
    expect(out[0]).toMatchObject({ state: "waiting", nextTryAt: 5000, attempts: 3 });
    expect(out[1]).toMatchObject({ state: "waiting", nextTryAt: 5000, attempts: 0 });
    expect(out[2]!.state).toBe("conflict");
  });
  it("enqueue dedupes by clientRef and by open match", () => {
    const a = mk("a");
    expect(enqueue([a], mk("a"))).toHaveLength(1);
    expect(enqueue([a], mk("b"))).toHaveLength(1);
    expect(enqueue([a], mk("b", "m2"))).toHaveLength(2);
    expect(enqueue([{ ...a, state: "synced" }], mk("b"))).toHaveLength(2);
  });
  it("summarize words", () => {
    expect(summarize([]).label).toBeNull();
    expect(summarize([mk("a")]).label).toBe("1 result waiting to send");
    expect(summarize([mk("a"), mk("b", "m2")]).label).toBe("2 results waiting to send");
    expect(summarize([{ ...mk("a"), state: "conflict" }]).label).toBe("1 needs your attention");
    expect(summarize([mk("a"), { ...mk("b", "m2"), state: "failed" }, { ...mk("c", "m3"), state: "conflict" }]).label).toBe("1 result waiting to send · 2 need your attention");
  });
  it("prune drops old synced items only", () => {
    const old = { ...mk("o", "m1", 0), state: "synced" as const };
    const fresh = { ...mk("n", "m2", 90_000_000), state: "synced" as const };
    const wait = mk("w", "m3", 0);
    expect(prune([old, fresh, wait], 90_000_001).map((i) => i.clientRef)).toEqual(["n", "w"]);
  });
});
