import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { accounts, sessions, users, verifications } from "@rallix/db/schema";
import { serviceDb } from "./db";
import { normalizePhone } from "./phone";
import { sendSms } from "./sms";

/**
 * Better Auth runs on the service role: it must read and write sessions and accounts,
 * which the app role cannot touch. Tables are ours (packages/db/src/schema/auth.ts).
 */
const g = globalThis as unknown as { __rallixAuth?: ReturnType<typeof create> };

function create() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(serviceDb(), {
      provider: "pg",
      schema: { users, sessions, accounts, verifications },
    }),
    user: { modelName: "users" },
    session: { modelName: "sessions", expiresIn: 60 * 60 * 24 * 30 },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    plugins: [
      phoneNumber({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        phoneNumberValidator: (p) => normalizePhone(p) === p,
        sendOTP: async ({ phoneNumber: to, code }) => { await sendSms(to, `Your Rallix code is ${code}. It expires in 5 minutes.`); },
        signUpOnVerification: {
          getTempEmail: (p) => `${p.replace("+", "")}@phone.rallix.app`,
          getTempName: () => "New player",
        },
      }),
      nextCookies(), // keep last
    ],
  });
}

export const auth = () => (g.__rallixAuth ??= create());
