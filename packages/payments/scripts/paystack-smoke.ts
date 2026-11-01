/**
 * Confirms our Paystack request/response shapes against the REAL API using your TEST secret key.
 * Safe: it only lists banks, resolves a test account and creates one test transaction (no money moves).
 *
 *   PAYSTACK_SECRET_KEY=sk_test_xxx pnpm --filter @rallix/payments smoke
 *   optional: SMOKE_ACCOUNT=0123456789 SMOKE_BANK=058 SMOKE_EMAIL=you@example.com
 */
import { PaystackProvider, generateReference } from "../src";

const key = process.env.PAYSTACK_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) { console.error("Set PAYSTACK_SECRET_KEY to a TEST key (sk_test_...). Refusing to run against a live key."); process.exit(1); }
const p = new PaystackProvider({ secretKey: key });

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try { const r = await fn(); console.log(`PASS  ${name}`, typeof r === "object" ? JSON.stringify(r).slice(0, 160) : r); return r; }
  catch (e) { console.log(`FAIL  ${name}: ${(e as Error).message}`); return null; }
}
const banks = await step("list banks", async () => { const b = await p.listBanks(); if (b.length < 5) throw new Error(`only ${b.length} banks returned`); return `${b.length} banks, first: ${b[0]!.name}`; });
await step("resolve account", () => p.resolveAccount({ accountNumber: process.env.SMOKE_ACCOUNT ?? "0000000000", bankCode: process.env.SMOKE_BANK ?? "058" }));
const ref = generateReference("D");
const init = await step("initialize transaction", () => p.initializeTransaction({ reference: ref, amountKobo: 10000, email: process.env.SMOKE_EMAIL ?? "smoke@example.com", callbackUrl: "https://example.com/pay/return", metadata: { smoke: 1 } }));
if (init) await step("verify (expect pending/abandoned, not success)", async () => { const v = await p.verifyTransaction(ref); if (v.status === "success") throw new Error("unexpectedly successful"); return `${v.status}, ${v.amountKobo} kobo ${v.currency}`; });
console.log(banks && init ? "\nShapes look right. Next: open the authorization_url, pay with a Paystack test card, and watch the webhook land." : "\nSome steps failed: paste the output so the integration can be corrected.");
