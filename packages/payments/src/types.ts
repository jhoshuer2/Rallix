/** Money is always integer kobo (NGN). Providers must never be handed naira or floats. */
export type Currency = "NGN";

export type Bank = { name: string; code: string };

export type InitializeInput = {
  reference: string;
  amountKobo: number;
  email: string;
  callbackUrl: string;
  /** Provider subaccount to split to (player dues). Omit to take the money on Rallix's own account (invoices). */
  subaccount?: string;
  /** Who pays the provider's processing fee when a subaccount is used. */
  bearer?: "account" | "subaccount";
  metadata?: Record<string, string | number>;
};
export type InitializeResult = { authorizationUrl: string; reference: string };

export type TxStatus = "success" | "failed" | "abandoned" | "pending";
export type VerifiedTransaction = {
  reference: string;
  status: TxStatus;
  amountKobo: number;
  currency: string;
  channel: string | null;
  paidAt: Date | null;
  providerId: string | null;
  metadata: Record<string, unknown>;
  raw: unknown;
};

export type WebhookEvent = { event: string; reference: string | null; raw: unknown };

export interface PaymentProvider {
  readonly name: "paystack" | "fake";
  initializeTransaction(input: InitializeInput): Promise<InitializeResult>;
  verifyTransaction(reference: string): Promise<VerifiedTransaction>;
  listBanks(): Promise<Bank[]>;
  resolveAccount(input: { accountNumber: string; bankCode: string }): Promise<{ accountName: string }>;
  createSubaccount(input: { businessName: string; bankCode: string; accountNumber: string }): Promise<{ subaccountCode: string }>;
  /** True only when `signature` is the HMAC-SHA512 of the exact raw body under the provider's secret. */
  verifyWebhookSignature(rawBody: string, signature: string | null | undefined): boolean;
  parseWebhook(rawBody: string): WebhookEvent;
}

export class PaymentError extends Error {
  constructor(message: string, readonly code: "provider_error" | "invalid_input" | "not_found" | "config" = "provider_error") {
    super(message);
    this.name = "PaymentError";
  }
}

/**
 * Prefer this to `instanceof PaymentError`. Bundlers (Next.js) can load this package more than once, and an error
 * created by one copy is not `instanceof` the class of another.
 */
export const isPaymentError = (e: unknown): e is PaymentError =>
  e instanceof PaymentError || (typeof e === "object" && e !== null && (e as { name?: unknown }).name === "PaymentError" && typeof (e as { code?: unknown }).code === "string");
