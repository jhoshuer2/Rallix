import { appEnv, isProduction } from "@rallix/config/env";
import { normalizeBaseUrl } from "@rallix/config/env";
import { createProvider, type PaymentProvider } from "@rallix/payments";

export const appUrl = () => normalizeBaseUrl(process.env.APP_URL) ?? normalizeBaseUrl(process.env.BETTER_AUTH_URL) ?? "http://localhost:3000";

const g = globalThis as unknown as { __rallixPay?: PaymentProvider };
/** The configured payment provider. Throws at first use in production if Paystack is not configured. */
export const provider = (): PaymentProvider => (g.__rallixPay ??= createProvider(appEnv(), appUrl()));
