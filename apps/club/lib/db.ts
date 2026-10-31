import { makeDb, type Db } from "@rallix/db";

/** Cached on globalThis so Next's dev reloads don't open a new pool each time. */
const g = globalThis as unknown as { __rallixApp?: Db; __rallixSvc?: Db };

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Copy apps/club/.env.example to .env.local.`);
  return v;
}

/** Subject to row-level security. Use only through withTenant(). */
export const appDb = (): Db => (g.__rallixApp ??= makeDb(need("DATABASE_URL_APP"), 10));
/** BYPASSRLS. Server-only: auth, stats engine, webhooks. Never call it with unchecked user input for scoping. */
export const serviceDb = (): Db => (g.__rallixSvc ??= makeDb(need("DATABASE_URL_SERVICE"), 5));
