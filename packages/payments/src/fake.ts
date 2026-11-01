import { signBody, verifySignature } from "./signature";
import { PaymentError, type Bank, type InitializeInput, type InitializeResult, type PaymentProvider, type VerifiedTransaction, type WebhookEvent } from "./types";

type Tx = { reference: string; amountKobo: number; status: "pending" | "success" | "failed"; email: string; metadata: Record<string, string | number>; paidAt: Date | null; subaccount?: string };
const g = globalThis as unknown as { __rallixFakePay?: Map<string, Tx> };
const store = () => (g.__rallixFakePay ??= new Map());

export const FAKE_SECRET = "fake_webhook_secret";
const BANKS: Bank[] = [{ name: "Access Bank", code: "044" }, { name: "GTBank", code: "058" }, { name: "Zenith Bank", code: "057" }, { name: "First Bank", code: "011" }];

/** Local stand-in for Paystack. Development and tests only: production refuses to start with it. */
export class FakeProvider implements PaymentProvider {
  readonly name = "fake" as const;
  constructor(private readonly baseUrl: string) {}

  async initializeTransaction(i: InitializeInput): Promise<InitializeResult> {
    if (!Number.isInteger(i.amountKobo) || i.amountKobo < 100) throw new PaymentError("Amount must be at least ₦1 and in whole kobo", "invalid_input");
    if (store().has(i.reference)) throw new PaymentError("Duplicate reference", "invalid_input");
    store().set(i.reference, { reference: i.reference, amountKobo: i.amountKobo, status: "pending", email: i.email, metadata: i.metadata ?? {}, paidAt: null, subaccount: i.subaccount });
    return { authorizationUrl: `${this.baseUrl}/pay/fake?reference=${encodeURIComponent(i.reference)}&callback=${encodeURIComponent(i.callbackUrl)}`, reference: i.reference };
  }
  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const t = store().get(reference);
    if (!t) throw new PaymentError("Transaction not found", "not_found");
    return { reference, status: t.status, amountKobo: t.amountKobo, currency: "NGN", channel: "fake", paidAt: t.paidAt, providerId: `fake-${reference}`, metadata: t.metadata, raw: t };
  }
  async listBanks() { return BANKS; }
  async resolveAccount({ accountNumber, bankCode }: { accountNumber: string; bankCode: string }) {
    if (!/^\d{10}$/.test(accountNumber)) throw new PaymentError("Account numbers have 10 digits", "invalid_input");
    if (!BANKS.some((b) => b.code === bankCode)) throw new PaymentError("Unknown bank", "invalid_input");
    if (accountNumber.endsWith("0000")) throw new PaymentError("Could not resolve that account", "not_found"); // lets tests exercise the failure path
    return { accountName: `TEST ACCOUNT ${accountNumber.slice(-4)}` };
  }
  async createSubaccount({ bankCode, accountNumber }: { businessName: string; bankCode: string; accountNumber: string }) {
    return { subaccountCode: `ACCT_fake_${bankCode}_${accountNumber.slice(-4)}` };
  }
  verifyWebhookSignature(rawBody: string, signature: string | null | undefined) { return verifySignature(FAKE_SECRET, rawBody, signature); }
  parseWebhook(rawBody: string): WebhookEvent {
    const j = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } };
    return { event: String(j.event ?? ""), reference: j.data?.reference ? String(j.data.reference) : null, raw: j };
  }

  /** Test and dev helpers used by the fake checkout page. Not part of PaymentProvider. */
  static complete(reference: string, outcome: "success" | "failed" = "success") {
    const t = store().get(reference);
    if (!t) throw new PaymentError("Transaction not found", "not_found");
    t.status = outcome; t.paidAt = outcome === "success" ? new Date() : null;
    return t;
  }
  static get(reference: string) { return store().get(reference) ?? null; }
  static webhookBody(reference: string, event = "charge.success") {
    const t = store().get(reference);
    const body = JSON.stringify({ event, data: { id: Date.now(), reference, status: t?.status ?? "success", amount: t?.amountKobo ?? 0, currency: "NGN", channel: "fake", metadata: t?.metadata ?? {} } });
    return { body, signature: signBody(FAKE_SECRET, body) };
  }
}
