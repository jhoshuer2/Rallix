import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../src/migrate";

/** Fresh database per run so every test proves the migrations apply from scratch. */
export default async function setup() {
  const script = fileURLToPath(new URL("../scripts/create-db.sh", import.meta.url));
  execFileSync(script, ["rallix_test"], { stdio: "pipe" });
  await runMigrations("postgres://rallix_owner:owner_dev@localhost:5432/rallix_test");
}
