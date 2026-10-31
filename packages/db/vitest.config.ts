import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      DATABASE_URL_OWNER: "postgres://rallix_owner:owner_dev@localhost:5432/rallix_test",
      DATABASE_URL_APP: "postgres://rallix_app:app_dev@localhost:5432/rallix_test",
      DATABASE_URL_SERVICE: "postgres://rallix_service:service_dev@localhost:5432/rallix_test",
    },
  },
});
