import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { normalizePhone } from "@rallix/config/phone";
import { accounts, sessions, users, verifications } from "@rallix/db/schema";
import { db } from "./db";

const g = globalThis as unknown as { __consoleAuth?: ReturnType<typeof create> };

/** Same user tables as the club app, but a different cookie prefix so both apps can run on localhost without clobbering each other. */
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
    plugins: [
      phoneNumber({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        phoneNumberValidator: (p) => normalizePhone(p) === p,
        sendOTP: async ({ phoneNumber: to, code }) => {
          if (process.env.NODE_ENV === "production") throw new Error("SMS provider not configured for the console.");
          console.log(`[sms:dev] to ${to}: Your Rallix code is ${code}. It expires in 5 minutes.`);
        },
        // No sign-up here: only existing users who are on the platform_admins list get in (see lib/guard.ts).
      }),
      nextCookies(),
    ],
  });
}
export const auth = () => (g.__consoleAuth ??= create());
