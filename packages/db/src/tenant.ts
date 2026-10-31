import { sql } from "drizzle-orm";
import type { Db } from "./client";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type TenantContext = { userId: string; clubId?: string | null };

/**
 * Run `fn` in a transaction whose RLS context is the given user and club.
 * set_config(..., true) is transaction-local, so the context never leaks to the next
 * request on a pooled connection. Always go through this helper for app-role queries.
 */
export async function withTenant<T>(db: Db, ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true), set_config('app.club_id', ${ctx.clubId ?? ""}, true)`);
    return fn(tx);
  });
}
