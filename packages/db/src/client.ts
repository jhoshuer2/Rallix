import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = ReturnType<typeof makeDb>;

export function makeDb(url: string, max = 10) {
  // Hosted Postgres (Supabase) needs TLS. DATABASE_SSL=require verifies the certificate; no-verify encrypts without
  // verifying it (Supabase's pooler chain is not in Node's trust store). Unset locally.
  const mode = process.env.DATABASE_SSL;
  const ssl = mode === "require" ? true : mode === "no-verify" ? { rejectUnauthorized: false } : undefined;
  // pg lets sslmode in the URL override the option, so drop it and rely on DATABASE_SSL.
  const cleaned = ssl === undefined ? url : url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
  const pool = new pg.Pool({ connectionString: cleaned, max, ssl });
  return Object.assign(drizzle(pool, { schema }), { pool });
}

/** Roles map to connection strings. The web app must only ever use `app`. */
export const urls = {
  owner: () => process.env.DATABASE_URL_OWNER ?? "postgres://rallix_owner:owner_dev@localhost:5432/rallix_dev",
  app: () => process.env.DATABASE_URL_APP ?? "postgres://rallix_app:app_dev@localhost:5432/rallix_dev",
  service: () => process.env.DATABASE_URL_SERVICE ?? "postgres://rallix_service:service_dev@localhost:5432/rallix_dev",
};
