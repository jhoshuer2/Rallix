import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, normalizeMailFrom } from "./env";

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
