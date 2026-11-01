import { describe, expect, it } from "vitest";
import { FakeProvider, PaymentError, PaystackProvider, createProvider, isPaymentError, generateReference, reconcile, referenceKind, signBody, verifySignature, type VerifiedTransaction } from "./index";

describe("webhook signature", () => {
  it("matches the RFC 4231 HMAC-SHA512 test vector (key = 20 x 0x0b, data = 'Hi There')", () => {
    expect(signBody("\x0b".repeat(20), "Hi There")).toBe("87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854");
  });
  const body = JSON.stringify({ event: "charge.success", data: { reference: "RLX-D-X", amount: 600000 } });
  const sig = signBody("sk_test_secret", body);
  it("accepts the exact body signed with the right secret", () => { expect(verifySignature("sk_test_secret", body, sig)).toBe(true); expect(verifySignature("sk_test_secret", body, sig.toUpperCase())).toBe(true); });
  it("rejects a changed body, wrong secret, missing, malformed or wrong-length signatures", () => {
    expect(verifySignature("sk_test_secret", body.replace("600000", "100"), sig)).toBe(false);
    expect(verifySignature("other_secret", body, sig)).toBe(false);
    expect(verifySignature("sk_test_secret", body, null)).toBe(false);
    expect(verifySignature("sk_test_secret", body, "")).toBe(false);
    expect(verifySignature("sk_test_secret", body, "not-hex!")).toBe(false);
    expect(verifySignature("sk_test_secret", body, sig.slice(0, 20))).toBe(false);
    expect(verifySignature("", body, sig)).toBe(false); // an unset secret must never validate anything
  });
});

describe("references", () => {
  it("are well formed, unique and classified by kind", () => {
    const refs = new Set(Array.from({ length: 2000 }, () => generateReference("D")));
    expect(refs.size).toBe(2000);
    const d = generateReference("D"), i = generateReference("I");
    expect(d).toMatch(/^RLX-D-[A-Z2-9]{20}$/); expect(referenceKind(d)).toBe("due"); expect(referenceKind(i)).toBe("invoice");
    for (const bad of ["", "RLX-X-ABCDEFGHJKMNPQRSTUVW", "RLX-D-short", "rlx-d-ABCDEFGHJKMNPQRSTUVW", "RLX-D-ABCDEFGHJKMNPQRSTUVW!"]) expect(referenceKind(bad)).toBeNull();
  });
});

describe("reconcile", () => {
  const v = (o: Partial<VerifiedTransaction> = {}): VerifiedTransaction => ({ reference: "R1", status: "success", amountKobo: 600000, currency: "NGN", channel: "card", paidAt: new Date(), providerId: "1", metadata: {}, raw: {}, ...o });
  const exp = { reference: "R1", amountKobo: 600000 };
  it("accepts only a successful, matching transaction", () => { expect(reconcile(exp, v())).toEqual({ ok: true }); });
  it("rejects every kind of mismatch", () => {
    expect(reconcile(exp, v({ amountKobo: 100 }))).toEqual({ ok: false, reason: "amount_mismatch" });
    expect(reconcile(exp, v({ amountKobo: 600001 }))).toEqual({ ok: false, reason: "amount_mismatch" });
    expect(reconcile(exp, v({ amountKobo: 6000.5 }))).toEqual({ ok: false, reason: "amount_mismatch" });
    expect(reconcile(exp, v({ currency: "USD" }))).toEqual({ ok: false, reason: "currency_mismatch" });
    expect(reconcile(exp, v({ reference: "R2" }))).toEqual({ ok: false, reason: "reference_mismatch" });
    for (const status of ["failed", "abandoned", "pending"] as const) expect(reconcile(exp, v({ status }))).toEqual({ ok: false, reason: "not_successful" });
  });
});

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
function fakeFetch(responses: Array<{ status?: number; json: unknown } | "network-error">) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), method: String(init.method), headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = responses.shift();
    if (!r || r === "network-error") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const ok = (data: unknown) => ({ json: { status: true, message: "ok", data } });

describe("PaystackProvider requests", () => {
  it("initialises a split payment on a subaccount, with the club bearing fees and the amount in whole kobo", async () => {
    const { f, calls } = fakeFetch([ok({ authorization_url: "https://checkout.paystack.com/abc", access_code: "x", reference: "RLX-D-1" })]);
    const p = new PaystackProvider({ secretKey: "sk_test_x", fetch: f });
    const r = await p.initializeTransaction({ reference: "RLX-D-1", amountKobo: 600000, email: "a@b.com", callbackUrl: "https://app.rallix.app/pay/return", subaccount: "ACCT_1", metadata: { dueId: "d1" } });
    expect(r.authorizationUrl).toBe("https://checkout.paystack.com/abc");
    expect(calls[0]).toMatchObject({ url: "https://api.paystack.co/transaction/initialize", method: "POST" });
    expect(calls[0]!.headers.Authorization).toBe("Bearer sk_test_x");
    expect(calls[0]!.body).toEqual({ email: "a@b.com", amount: 600000, currency: "NGN", reference: "RLX-D-1", callback_url: "https://app.rallix.app/pay/return", subaccount: "ACCT_1", bearer: "subaccount", metadata: { dueId: "d1" } });
  });
  it("takes invoice payments on Rallix's own account: no subaccount, no bearer", async () => {
    const { f, calls } = fakeFetch([ok({ authorization_url: "u", reference: "RLX-I-1" })]);
    await new PaystackProvider({ secretKey: "k", fetch: f }).initializeTransaction({ reference: "RLX-I-1", amountKobo: 2000000, email: "a@b.com", callbackUrl: "c" });
    expect(calls[0]!.body).not.toHaveProperty("subaccount"); expect(calls[0]!.body).not.toHaveProperty("bearer");
  });
  it("refuses fractional, tiny or non-integer amounts before calling the network", async () => {
    const { f, calls } = fakeFetch([]);
    const p = new PaystackProvider({ secretKey: "k", fetch: f });
    for (const amountKobo of [0, 50, 99.5, 600000.5, NaN]) await expect(p.initializeTransaction({ reference: "r", amountKobo, email: "a@b.com", callbackUrl: "c" })).rejects.toMatchObject({ code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });
  it("verifies a transaction and parses it", async () => {
    const { f, calls } = fakeFetch([ok({ id: 99, status: "success", reference: "RLX-D-1", amount: 600000, currency: "NGN", channel: "card", paid_at: "2026-11-01T10:00:00.000Z", metadata: { dueId: "d1" } })]);
    const v = await new PaystackProvider({ secretKey: "k", fetch: f }).verifyTransaction("RLX-D-1");
    expect(calls[0]).toMatchObject({ url: "https://api.paystack.co/transaction/verify/RLX-D-1", method: "GET" });
    expect(v).toMatchObject({ status: "success", amountKobo: 600000, currency: "NGN", channel: "card", providerId: "99", metadata: { dueId: "d1" } });
    expect(v.paidAt?.toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });
  it("treats unknown statuses as pending, never as success", async () => {
    const { f } = fakeFetch([ok({ status: "ongoing", reference: "R", amount: 1, currency: "NGN" })]);
    expect((await new PaystackProvider({ secretKey: "k", fetch: f }).verifyTransaction("R")).status).toBe("pending");
  });
  it("encodes the reference in the URL", async () => {
    const { f, calls } = fakeFetch([ok({ status: "failed", reference: "a/b", amount: 1, currency: "NGN" })]);
    await new PaystackProvider({ secretKey: "k", fetch: f }).verifyTransaction("a/b?x=1");
    expect(calls[0]!.url).toBe("https://api.paystack.co/transaction/verify/a%2Fb%3Fx%3D1");
  });
  it("lists banks sorted, and caches the list", async () => {
    const { f, calls } = fakeFetch([ok([{ name: "Zenith", code: "057" }, { name: "Access", code: "044" }, { name: "", code: "x" }])]);
    const p = new PaystackProvider({ secretKey: "k", fetch: f });
    expect((await p.listBanks()).map((b) => b.name)).toEqual(["Access", "Zenith"]);
    await p.listBanks();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/bank?country=nigeria");
  });
  it("validates account numbers locally and resolves names", async () => {
    const { f, calls } = fakeFetch([ok({ account_number: "0123456789", account_name: "PARIS ARENA TTC" })]);
    const p = new PaystackProvider({ secretKey: "k", fetch: f });
    await expect(p.resolveAccount({ accountNumber: "123", bankCode: "044" })).rejects.toMatchObject({ code: "invalid_input" });
    expect(calls).toHaveLength(0);
    expect(await p.resolveAccount({ accountNumber: "0123456789", bankCode: "044" })).toEqual({ accountName: "PARIS ARENA TTC" });
    expect(calls[0]!.url).toContain("account_number=0123456789&bank_code=044");
  });
  it("creates subaccounts with a 0% platform share so the club receives the full amount", async () => {
    const { f, calls } = fakeFetch([ok({ subaccount_code: "ACCT_abc" })]);
    expect(await new PaystackProvider({ secretKey: "k", fetch: f }).createSubaccount({ businessName: "Paris Arena", bankCode: "044", accountNumber: "0123456789" })).toEqual({ subaccountCode: "ACCT_abc" });
    expect(calls[0]!.body).toEqual({ business_name: "Paris Arena", settlement_bank: "044", account_number: "0123456789", percentage_charge: 0 });
  });
  it("turns provider and network failures into clear PaymentErrors", async () => {
    const mk = (r: Parameters<typeof fakeFetch>[0][number]) => new PaystackProvider({ secretKey: "k", fetch: fakeFetch([r]).f });
    await expect(mk({ status: 400, json: { status: false, message: "Invalid key" } }).verifyTransaction("r")).rejects.toThrow("Invalid key");
    await expect(mk({ status: 404, json: { status: false, message: "Transaction reference not found" } }).verifyTransaction("r")).rejects.toMatchObject({ code: "not_found" });
    await expect(mk({ status: 200, json: { status: false, message: "nope" } }).listBanks()).rejects.toBeInstanceOf(PaymentError);
    await expect(mk("network-error").verifyTransaction("r")).rejects.toThrow(/could not reach paystack/i);
  });
  it("verifies and parses webhooks", () => {
    const p = new PaystackProvider({ secretKey: "sk_test_k", fetch: fakeFetch([]).f });
    const body = JSON.stringify({ event: "charge.success", data: { reference: "RLX-D-9" } });
    expect(p.verifyWebhookSignature(body, signBody("sk_test_k", body))).toBe(true);
    expect(p.verifyWebhookSignature(body, signBody("sk_live_other", body))).toBe(false);
    expect(p.parseWebhook(body)).toMatchObject({ event: "charge.success", reference: "RLX-D-9" });
  });
  it("will not construct without a secret key", () => { expect(() => new PaystackProvider({ secretKey: "" })).toThrow(/PAYSTACK_SECRET_KEY/); });
});

describe("provider selection", () => {
  it("defaults to the fake provider in development", () => { expect(createProvider({ NODE_ENV: "development" }, "http://x").name).toBe("fake"); });
  it("refuses the fake provider in production, however it is requested", () => {
    expect(() => createProvider({ NODE_ENV: "production", PAYMENTS_PROVIDER: "fake" }, "http://x")).toThrow(/not allowed in production/);
  });
  it("production defaults to Paystack and needs the key", () => {
    expect(() => createProvider({ NODE_ENV: "production" }, "http://x")).toThrow(/PAYSTACK_SECRET_KEY/);
    expect(createProvider({ NODE_ENV: "production", PAYSTACK_SECRET_KEY: "sk_live_x" }, "http://x").name).toBe("paystack");
  });
  it("rejects unknown names", () => { expect(() => createProvider({ PAYMENTS_PROVIDER: "stripe" }, "http://x")).toThrow(/Unknown PAYMENTS_PROVIDER/); });
});

describe("FakeProvider", () => {
  const fake = new FakeProvider("http://localhost:3000");
  it("runs a full pay-and-verify loop and signs webhooks the real verifier accepts", async () => {
    const ref = generateReference("D");
    const init = await fake.initializeTransaction({ reference: ref, amountKobo: 600000, email: "a@b.com", callbackUrl: "http://localhost:3000/pay/return" });
    expect(init.authorizationUrl).toContain("/pay/fake?reference=" + ref);
    expect((await fake.verifyTransaction(ref)).status).toBe("pending");
    FakeProvider.complete(ref);
    expect(await fake.verifyTransaction(ref)).toMatchObject({ status: "success", amountKobo: 600000, currency: "NGN" });
    const { body, signature } = FakeProvider.webhookBody(ref);
    expect(fake.verifyWebhookSignature(body, signature)).toBe(true);
    expect(fake.verifyWebhookSignature(body + " ", signature)).toBe(false);
  });
  it("refuses duplicate references and unknown transactions", async () => {
    const ref = generateReference("I");
    await fake.initializeTransaction({ reference: ref, amountKobo: 100, email: "a@b.com", callbackUrl: "c" });
    await expect(fake.initializeTransaction({ reference: ref, amountKobo: 100, email: "a@b.com", callbackUrl: "c" })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(fake.verifyTransaction("nope")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("isPaymentError", () => {
  it("recognises errors from a duplicate copy of the package, which instanceof cannot", () => {
    const foreign = Object.assign(new Error("Could not resolve that account"), { name: "PaymentError", code: "not_found" });
    expect(foreign instanceof PaymentError).toBe(false);
    expect(isPaymentError(foreign)).toBe(true);
    expect(isPaymentError(new PaymentError("x", "not_found"))).toBe(true);
  });
  it("does not match ordinary errors or look-alikes", () => {
    for (const e of [new Error("x"), new TypeError("y"), { name: "PaymentError" }, null, undefined, "PaymentError", Object.assign(new Error("z"), { name: "PaymentError" })]) expect(isPaymentError(e)).toBe(false);
  });
});

import { generatePayToken, isPayTokenShape, shouldReactivate } from "./index";

describe("pay tokens", () => {
  it("are 24 plain characters with no look-alikes, and never repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) { const t = generatePayToken(); expect(t).toMatch(/^[A-HJKMNP-Za-hjkmnp-z2-9]{24}$/); seen.add(t); }
    expect(seen.size).toBe(5000);
  });
  it("use every symbol roughly evenly (no modulo bias)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) for (const c of generatePayToken()) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect(counts.size).toBe(54);
    const values = [...counts.values()], mean = values.reduce((a, b) => a + b, 0) / values.length;
    for (const v of values) expect(Math.abs(v - mean) / mean).toBeLessThan(0.1);
  });
  it("shape check rejects anything that is not a plausible token", () => {
    expect(isPayTokenShape(generatePayToken())).toBe(true);
    for (const bad of ["", "short", "a".repeat(23), "a".repeat(65), "has space 123456789012345", "../../etc/passwd/aaaaaaaa", "a'; drop table x;--aaaaaaaa", null, undefined, 123, {}]) expect(isPayTokenShape(bad)).toBe(false);
  });
});

describe("shouldReactivate", () => {
  const now = new Date("2026-11-10T12:00:00Z"), past = new Date("2026-11-01T00:00:00Z"), future = new Date("2026-11-20T00:00:00Z");
  const base = { clubStatus: "suspended" as const, suspensionReason: "non_payment" as const, otherUnpaidInvoices: [], now };
  it("reactivates a non-payment suspension once nothing else is overdue", () => { expect(shouldReactivate(base)).toBe(true); });
  it("never reactivates a suspension for any other reason, or with no recorded reason", () => {
    expect(shouldReactivate({ ...base, suspensionReason: "other" })).toBe(false);
    expect(shouldReactivate({ ...base, suspensionReason: null })).toBe(false);
  });
  it("never touches active or closed clubs", () => {
    expect(shouldReactivate({ ...base, clubStatus: "active" })).toBe(false);
    expect(shouldReactivate({ ...base, clubStatus: "closed" })).toBe(false);
  });
  it("waits while another invoice is overdue, but not while one is merely upcoming", () => {
    expect(shouldReactivate({ ...base, otherUnpaidInvoices: [{ dueAt: past }] })).toBe(false);
    expect(shouldReactivate({ ...base, otherUnpaidInvoices: [{ dueAt: future }] })).toBe(true);
    expect(shouldReactivate({ ...base, otherUnpaidInvoices: [{ dueAt: future }, { dueAt: past }] })).toBe(false);
  });
  it("treats an invoice with no due date as overdue, and the due instant itself as overdue", () => {
    expect(shouldReactivate({ ...base, otherUnpaidInvoices: [{ dueAt: null }] })).toBe(false);
    expect(shouldReactivate({ ...base, otherUnpaidInvoices: [{ dueAt: now }] })).toBe(false);
  });
});

import { DEFAULT_OFFSETS, GRACE_DAYS, checkOffsets, daysBetween, describeOffset, nextReminder, timingPhrase } from "./index";

describe("daysBetween", () => {
  it("counts whole days across month ends, leap years and daylight saving", () => {
    expect(daysBetween("2026-11-28", "2026-11-28")).toBe(0);
    expect(daysBetween("2026-11-28", "2026-12-01")).toBe(3);
    expect(daysBetween("2026-12-01", "2026-11-28")).toBe(-3);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2); // leap year
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("checkOffsets", () => {
  it("normalises: unique and sorted", () => { expect(checkOffsets([7, -3, 0, -3])).toEqual({ ok: true, offsets: [-3, 0, 7] }); });
  it("rejects empty, too many, out of range, fractional and non-numbers", () => {
    for (const bad of [[], [1, 2, 3, 4, 5, 6, 7], [-15], [31], [1.5], ["3"], [NaN], [null], "3", null, undefined, {}]) expect(checkOffsets(bad as unknown).ok, JSON.stringify(bad)).toBe(false);
    expect(checkOffsets([-14, 30]).ok).toBe(true);
  });
});

describe("nextReminder", () => {
  const base = { dueDate: "2026-11-28", offsets: DEFAULT_OFFSETS, alreadySent: new Set<number>() };
  const on = (today: string, sent: number[] = [], grace?: number) => nextReminder({ ...base, today, alreadySent: new Set(sent), grace });
  it("sends exactly on each configured day", () => {
    expect(on("2026-11-25")).toBe(-3); expect(on("2026-11-28")).toBe(0); expect(on("2026-12-01")).toBe(3); expect(on("2026-12-05")).toBe(7);
  });
  it("sends nothing on quiet days (before the first reminder, between windows, long after)", () => { for (const d of ["2026-11-20", "2026-11-24", "2026-12-04", "2026-12-15"]) expect(on(d), d).toBeNull(); });
  it("never repeats a reminder that was already sent", () => { expect(on("2026-11-25", [-3])).toBeNull(); expect(on("2026-11-28", [0])).toBeNull(); expect(on("2026-11-28", [-3])).toBe(0); });
  it("catches up within the grace window after an outage, but only the latest one", () => {
    expect(on("2026-11-26")).toBe(-3);               // missed day -3 by one day: still sent
    expect(on("2026-11-27")).toBe(-3);               // by two days: still sent (grace = 2)
    expect(on("2026-11-27", [], 0)).toBeNull();      // with no grace it is skipped
    expect(on("2026-12-01", [])).toBe(3);            // day 3 AND earlier ones eligible? only the latest in window
    expect(on("2026-12-02")).toBe(3);
    expect(on("2026-12-04")).toBeNull();             // 3 days after offset 3: past grace; offset 7 not yet
  });
  it("after a long outage never sends a burst of old reminders", () => {
    const sent: number[] = []; const got = on("2026-12-05"); expect(got).toBe(7); sent.push(got!);
    expect(on("2026-12-05", sent)).toBeNull();
  });
  it("is stable for every day across a month: at most one reminder per day, never a duplicate", () => {
    const sent = new Set<number>(); let count = 0;
    for (let i = -20; i <= 20; i++) { const today = new Date(Date.UTC(2026, 10, 28 + i)).toISOString().slice(0, 10); const r = nextReminder({ ...base, today, alreadySent: sent }); if (r !== null) { expect(sent.has(r)).toBe(false); sent.add(r); count++; } }
    expect(count).toBe(DEFAULT_OFFSETS.length); expect([...sent].sort((a, b) => a - b)).toEqual([...DEFAULT_OFFSETS]);
  });
  it("works for a due date at a month or year boundary", () => { expect(nextReminder({ dueDate: "2026-12-31", today: "2026-12-28", offsets: [-3], alreadySent: new Set() })).toBe(-3); expect(nextReminder({ dueDate: "2026-12-31", today: "2027-01-03", offsets: [3], alreadySent: new Set() })).toBe(3); });
  it("uses the documented grace default", () => { expect(GRACE_DAYS).toBe(2); });
});

describe("wording", () => {
  it("reads naturally for every case", () => {
    expect(timingPhrase(-7)).toBe("are due in 7 days"); expect(timingPhrase(-1)).toBe("are due tomorrow"); expect(timingPhrase(0)).toBe("are due today");
    expect(timingPhrase(1)).toBe("were due yesterday"); expect(timingPhrase(3)).toBe("were due 3 days ago");
    expect(describeOffset(-3)).toBe("3 days before"); expect(describeOffset(-1)).toBe("The day before"); expect(describeOffset(0)).toBe("On the due date"); expect(describeOffset(1)).toBe("1 day after"); expect(describeOffset(7)).toBe("7 days after");
  });
});
