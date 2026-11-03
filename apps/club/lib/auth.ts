import { normalizeBaseUrl } from "@rallix/config/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { accounts, sessions, users, verifications } from "@rallix/db/schema";
import { serviceDb } from "./db";
import { sendSignInCode } from "./mail";

/**
 * Better Auth runs on the service role: it must read and write sessions and accounts,
 * which the app role cannot touch. Tables are ours (packages/db/src/schema/auth.ts).
 * Sign-in is by an emailed 6-digit code. A first successful code creates the account.
 */
const g = globalThis as unknown as { __rallixAuth?: ReturnType<typeof create> };

function create() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: normalizeBaseUrl(process.env.BETTER_AUTH_URL),
    database: drizzleAdapter(serviceDb(), {
      provider: "pg",
      schema: { users, sessions, accounts, verifications },
    }),
    user: { modelName: "users" },
    session: { modelName: "sessions", expiresIn: 60 * 60 * 24 * 30 },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    // Always on (Better Auth only enables it in production by default). Memory storage is per server instance; the per-address cap in lib/mail.ts is stored in the database.
    rateLimit: { enabled: true, window: 60, max: 100, customRules: { "/email-otp/send-verification-otp": { window: 60, max: 15 }, "/sign-in/email-otp": { window: 60, max: 30 } } },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp }) => { await sendSignInCode(email, otp); },
      }),
      nextCookies(), // keep last
    ],
  });
}

export const auth = () => (g.__rallixAuth ??= create());
