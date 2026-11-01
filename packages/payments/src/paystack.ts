import { verifySignature } from "./signature";
import { PaymentError, type Bank, type InitializeInput, type InitializeResult, type PaymentProvider, type TxStatus, type VerifiedTransaction, type WebhookEvent } from "./types";

type Fetch = typeof fetch;
type Envelope<T> = { status: boolean; message?: string; data: T };

/**
 * Paystack REST client. Endpoint paths and field names follow Paystack's public API as documented;
 * confirm them against a TEST key with `pnpm --filter @rallix/payments smoke` before going live.
 */
export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack" as const;
  private readonly baseUrl: string;
  private readonly fetchFn: Fetch;
  private banksCache: { at: number; banks: Bank[] } | null = null;

  constructor(private readonly opts: { secretKey: string; baseUrl?: string; fetch?: Fetch }) {
    if (!opts.secretKey) throw new PaymentError("PAYSTACK_SECRET_KEY is not set", "config");
    this.baseUrl = opts.baseUrl ?? "https://api.paystack.co";
    this.fetchFn = opts.fetch ?? fetch;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.opts.secretKey}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new PaymentError("Could not reach Paystack. Please try again.");
    }
    let json: Envelope<T> | null = null;
    try { json = (await res.json()) as Envelope<T>; } catch { /* handled below */ }
    if (!res.ok || !json || json.status !== true) {
      throw new PaymentError(json?.message ?? `Paystack returned ${res.status}`, res.status === 404 ? "not_found" : "provider_error");
    }
    return json.data;
  }

  async initializeTransaction(i: InitializeInput): Promise<InitializeResult> {
    if (!Number.isInteger(i.amountKobo) || i.amountKobo < 100) throw new PaymentError("Amount must be at least ₦1 and in whole kobo", "invalid_input");
    const data = await this.call<{ authorization_url: string; reference: string }>("POST", "/transaction/initialize", {
      email: i.email, amount: i.amountKobo, currency: "NGN", reference: i.reference, callback_url: i.callbackUrl,
      ...(i.subaccount ? { subaccount: i.subaccount, bearer: i.bearer ?? "subaccount" } : {}),
      ...(i.metadata ? { metadata: i.metadata } : {}),
    });
    if (!data?.authorization_url) throw new PaymentError("Paystack did not return a checkout link");
    return { authorizationUrl: data.authorization_url, reference: data.reference ?? i.reference };
  }

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const d = await this.call<Record<string, unknown>>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
    const status = (["success", "failed", "abandoned"].includes(String(d.status)) ? d.status : "pending") as TxStatus;
    return {
      reference: String(d.reference ?? ""), status, amountKobo: Number(d.amount), currency: String(d.currency ?? ""),
      channel: d.channel ? String(d.channel) : null, paidAt: d.paid_at ? new Date(String(d.paid_at)) : null,
      providerId: d.id != null ? String(d.id) : null,
      metadata: d.metadata && typeof d.metadata === "object" ? (d.metadata as Record<string, unknown>) : {}, raw: d,
    };
  }

  async listBanks(): Promise<Bank[]> {
    if (this.banksCache && Date.now() - this.banksCache.at < 24 * 3600 * 1000) return this.banksCache.banks;
    const data = await this.call<Array<{ name: string; code: string }>>("GET", "/bank?country=nigeria&perPage=200");
    const banks = data.filter((b) => b.name && b.code).map((b) => ({ name: b.name, code: b.code })).sort((a, b) => a.name.localeCompare(b.name));
    this.banksCache = { at: Date.now(), banks };
    return banks;
  }

  async resolveAccount({ accountNumber, bankCode }: { accountNumber: string; bankCode: string }) {
    if (!/^\d{10}$/.test(accountNumber)) throw new PaymentError("Account numbers have 10 digits", "invalid_input");
    const d = await this.call<{ account_name: string }>("GET", `/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`);
    return { accountName: d.account_name };
  }

  async createSubaccount({ businessName, bankCode, accountNumber }: { businessName: string; bankCode: string; accountNumber: string }) {
    const d = await this.call<{ subaccount_code: string }>("POST", "/subaccount", {
      business_name: businessName, settlement_bank: bankCode, account_number: accountNumber,
      // Rallix takes no share of player dues. The whole amount, minus Paystack's fee, settles to the club.
      percentage_charge: 0,
    });
    if (!d?.subaccount_code) throw new PaymentError("Paystack did not return a subaccount code");
    return { subaccountCode: d.subaccount_code };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null | undefined) {
    return verifySignature(this.opts.secretKey, rawBody, signature);
  }

  parseWebhook(rawBody: string): WebhookEvent {
    const j = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } };
    return { event: String(j.event ?? ""), reference: j.data?.reference ? String(j.data.reference) : null, raw: j };
  }
}
