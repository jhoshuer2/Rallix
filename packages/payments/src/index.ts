import { FakeProvider } from "./fake";
import { PaystackProvider } from "./paystack";
import { PaymentError, type PaymentProvider } from "./types";

export * from "./types";
export * from "./signature";
export * from "./reference";
export * from "./reconcile";
export * from "./reactivation";
export { PaystackProvider } from "./paystack";
export { FakeProvider, FAKE_SECRET } from "./fake";

/**
 * Pick the provider from the environment. Production must use Paystack: the fake provider would let anyone "pay" for free.
 *   PAYMENTS_PROVIDER=paystack|fake   (default: fake outside production, paystack in production)
 */
export function createProvider(env: Record<string, string | undefined>, appUrl: string): PaymentProvider {
  const production = env.NODE_ENV === "production";
  const choice = env.PAYMENTS_PROVIDER ?? (production ? "paystack" : "fake");
  if (choice === "fake") {
    if (production) throw new PaymentError("PAYMENTS_PROVIDER=fake is not allowed in production", "config");
    return new FakeProvider(appUrl);
  }
  if (choice === "paystack") return new PaystackProvider({ secretKey: env.PAYSTACK_SECRET_KEY ?? "" });
  throw new PaymentError(`Unknown PAYMENTS_PROVIDER "${choice}"`, "config");
}
