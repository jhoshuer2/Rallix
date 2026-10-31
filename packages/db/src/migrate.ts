import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { makeDb, urls } from "./client";

export async function runMigrations(url = urls.owner()) {
  const db = makeDb(url, 1);
  try {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  } finally {
    await db.pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations().then(() => console.log("migrations applied"), (e) => { console.error(e); process.exit(1); });
}
