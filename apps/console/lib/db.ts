import { makeDb, type Db } from "@rallix/db";

const g = globalThis as unknown as { __consoleDb?: Db };

/** The console uses only the service role (BYPASSRLS). Every mutation must go through requireAdmin() and write an audit row. */
export const db = (): Db => {
  const url = process.env.DATABASE_URL_SERVICE;
  if (!url) throw new Error("DATABASE_URL_SERVICE is not set. Copy apps/console/.env.example to .env.local.");
  return (g.__consoleDb ??= makeDb(url, 8));
};
