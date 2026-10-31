import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_OWNER ?? "postgres://rallix_owner:owner_dev@localhost:5432/rallix_dev" },
});
