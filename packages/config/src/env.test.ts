import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, normalizeMailFrom, trustedOriginsFrom } from "./env";

describe("normalizeBaseUrl", () => {
  it("adds https:// when the scheme is missing", () => expect(normalizeBaseUrl("console.rallix.ng")).toBe("https://console.rallix.ng"));
  it("keeps a good URL and drops a trailing slash", () => {
    expect(normalizeBaseUrl("https://app.rallix.ng/")).toBe("https://app.rallix.ng");
    expect(normalizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });
  it("trims spaces and removes quote marks", () => {
    expect(normalizeBaseUrl('  "https://app.rallix.ng"  ')).toBe("https://app.rallix.ng");
    expect(normalizeBaseUrl("'app.rallix.ng'")).toBe("https://app.rallix.ng");
  });
  it("uses http for localhost without a scheme", () => expect(normalizeBaseUrl("localhost:3001")).toBe("http://localhost:3001"));
  it("leaves empty values undefined", () => {
    expect(normalizeBaseUrl(undefined)).toBeUndefined();
    expect(normalizeBaseUrl("")).toBeUndefined();
    expect(normalizeBaseUrl('  ""  ')).toBeUndefined();
  });
});

describe("normalizeMailFrom", () => {
  it("removes quote marks wrapped around the whole value", () => {
    expect(normalizeMailFrom('"Rallix <no-reply@rallix.ng>"')).toBe("Rallix <no-reply@rallix.ng>");
    expect(normalizeMailFrom("'no-reply@rallix.ng'")).toBe("no-reply@rallix.ng");
  });
  it("keeps a display name that has its own quotes", () => expect(normalizeMailFrom('"Rallix" <no-reply@rallix.ng>')).toBe('"Rallix" <no-reply@rallix.ng>'));
  it("returns an empty string when unset", () => expect(normalizeMailFrom(undefined)).toBe(""));
});

import { appEnv, ciE2eAllowed, isProduction } from "./env";

describe("production safety and the CI exception", () => {
  const local = { DATABASE_URL_APP: "postgres://a:b@localhost:5432/x", DATABASE_URL_SERVICE: "postgres://a:b@127.0.0.1:5432/x" };
  it("is production when NODE_ENV says so and nothing else is set", () => {
    expect(isProduction({ NODE_ENV: "production" })).toBe(true);
    expect(isProduction({ NODE_ENV: "development" })).toBe(false);
    expect(isProduction({})).toBe(false);
  });
  it("allows the exception only with the flag, off Vercel, and with every database on this machine", () => {
    expect(ciE2eAllowed({ RALLIX_CI_E2E: "1", ...local })).toBe(true);
    expect(isProduction({ NODE_ENV: "production", RALLIX_CI_E2E: "1", ...local })).toBe(false);
    expect(appEnv({ NODE_ENV: "production", RALLIX_CI_E2E: "1", ...local }).NODE_ENV).toBe("development");
  });
  it("ignores the flag everywhere that matters", () => {
    for (const bad of [
      { RALLIX_CI_E2E: "1", VERCEL: "1", ...local },
      { RALLIX_CI_E2E: "1", DATABASE_URL_APP: "postgres://a:b@db.supabase.co:5432/x", DATABASE_URL_SERVICE: local.DATABASE_URL_SERVICE },
      { RALLIX_CI_E2E: "1", DATABASE_URL_APP: "postgres://a:b@aws-0-eu-west-2.pooler.supabase.com:5432/postgres" },
      { RALLIX_CI_E2E: "1" }, // no database at all
      { RALLIX_CI_E2E: "true", ...local }, // only exactly "1"
      { ...local },
      { RALLIX_CI_E2E: "1", DATABASE_URL_APP: "not a url" },
      { RALLIX_CI_E2E: "1", DATABASE_URL_APP: "postgres://a:b@localhost.evil.com:5432/x" },
    ]) {
      expect(ciE2eAllowed(bad)).toBe(false);
      expect(isProduction({ NODE_ENV: "production", ...bad })).toBe(true);
      expect(appEnv({ NODE_ENV: "production", ...bad }).NODE_ENV).toBe("production");
    }
  });
  it("leaves a development environment untouched", () => {
    const e = { NODE_ENV: "development", RALLIX_CI_E2E: "1", ...local };
    expect(appEnv(e).NODE_ENV).toBe("development");
  });
});

describe("trustedOriginsFrom", () => {
  it("collects the app's own addresses and Vercel's, as origins", () => {
    expect(trustedOriginsFrom({ BETTER_AUTH_URL: "https://app.rallix.ng/", APP_URL: "app.rallix.ng", VERCEL_URL: "rallix-club-abc.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "rallix-club.vercel.app" }).sort())
      .toEqual(["https://app.rallix.ng", "https://rallix-club-abc.vercel.app", "https://rallix-club.vercel.app"]);
  });
  it("ignores empty, plain-http and invalid values (except localhost)", () => {
    expect(trustedOriginsFrom({ APP_URL: "", CLUB_APP_URL: "http://evil.example", VERCEL_URL: "not a url", BETTER_AUTH_URL: "http://localhost:3000" })).toEqual(["http://localhost:3000"]);
  });
});
