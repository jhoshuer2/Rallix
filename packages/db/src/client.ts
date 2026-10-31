import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = ReturnType<typeof makeDb>;

export function makeDb(url: string, max = 10) {
  const pool = new pg.Pool({ connectionString: url, max });
  return Object.assign(drizzle(pool, { schema }), { pool });
}

/** Roles map to connection strings. The web app must only ever use `app`. */
export const urls = {
  owner: () => process.env.DATABASE_URL_OWNER ?? "postgres://rallix_owner:owner_dev@localhost:5432/rallix_dev",
  app: () => process.env.DATABASE_URL_APP ?? "postgres://rallix_app:app_dev@localhost:5432/rallix_dev",
  service: () => process.env.DATABASE_URL_SERVICE ?? "postgres://rallix_service:service_dev@localhost:5432/rallix_dev",
};
