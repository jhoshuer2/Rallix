import { normalizeBaseUrl, trustedOriginsFrom } from "@rallix/config/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, username } from "better-auth/plugins";
import { accounts, sessions, users, verifications } from "@rallix/db/schema";
import { serviceDb } from "./db";
import { sendSignInCode } from "./mail";

/**
 * Better Auth runs on the service role: it must read and write sessions and accounts,
 * which the app role cannot touch. Tables are ours (packages/db/src/schema/auth.ts).
 * Sign-in is by an emailed 6-digit code. A first successful code creates the account.
 * A person can then add a username and password (account page) and sign in with either. Passwords never create accounts (disableSignUp),
 * so every account has a verified email.
 */
const g = globalThis as unknown as { __rallixAuth?: ReturnType<typeof create> };

function create() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: normalizeBaseUrl(process.env.BETTER_AUTH_URL),
    // Another address of this same app (for example the Vercel address an invite was opened on) must not be refused as a foreign origin.
    trustedOrigins: trustedOriginsFrom(process.env),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 128 },
    database: drizzleAdapter(serviceDb(), {
      provider: "pg",
      schema: { users, sessions, accounts, verifications },
    }),
    user: { modelName: "users" },
    session: { modelName: "sessions", expiresIn: 60 * 60 * 24 * 30 },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    // Always on (Better Auth only enables it in production by default). Memory storage is per server instance; the per-address cap in lib/mail.ts is stored in the database.
    rateLimit: { enabled: true, window: 60, max: 100, customRules: { "/email-otp/send-verification-otp": { window: 60, max: 15 }, "/sign-in/email-otp": { window: 60, max: 30 }, "/sign-in/email": { window: 60, max: 10 }, "/sign-in/username": { window: 60, max: 10 } } },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp }) => { await sendSignInCode(email, otp); },
      }),
      username({ minUsernameLength: 3, maxUsernameLength: 20, usernameValidator: (u) => /^[a-z0-9_]+$/.test(u), validationOrder: { username: "post-normalization" } }),
      nextCookies(), // keep last
    ],
  });
}

export const auth = () => (g.__rallixAuth ??= create());
