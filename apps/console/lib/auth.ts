import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { accounts, sessions, users, verifications } from "@rallix/db/schema";
import { db } from "./db";
import { sendStaffCode } from "./mail";

const g = globalThis as unknown as { __consoleAuth?: ReturnType<typeof create> };

/**
 * Same user tables as the club app, but a different cookie prefix so both apps can run on localhost without clobbering each other.
 * `disableSignUp`: the console NEVER creates accounts. An unknown email gets no code and the same response as a known one,
 * so the form does not reveal who exists. Even a valid sign-in is not enough: lib/guard.ts also requires platform_admins.
 */
function create() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(db(), { provider: "pg", schema: { users, sessions, accounts, verifications } }),
    user: { modelName: "users" },
    session: { modelName: "sessions", expiresIn: 60 * 60 * 12 }, // staff sessions are short
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    advanced: { cookiePrefix: "rallix-console" },
    rateLimit: { enabled: true, window: 60, max: 100, customRules: { "/email-otp/send-verification-otp": { window: 60, max: 15 }, "/sign-in/email-otp": { window: 60, max: 30 } } },
    plugins: [
      emailOTP({
        otpLength: 6, expiresIn: 300, allowedAttempts: 3, storeOTP: "hashed", disableSignUp: true,
        sendVerificationOTP: async ({ email, otp }) => { await sendStaffCode(email, otp); },
      }),
      nextCookies(),
    ],
  });
}
export const auth = () => (g.__consoleAuth ??= create());
