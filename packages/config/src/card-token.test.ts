import { describe, expect, it } from "vitest";
import { signCardToken, verifyCardToken } from "./card-token";

const S = "a-long-enough-server-secret-0001";
const C = "11111111-1111-4111-8111-111111111111", M = "22222222-2222-4222-8222-222222222222";
const T0 = new Date("2030-01-01T10:00:30Z");

describe("member card token", () => {
  it("verifies for the same club and member, now and up to the next minute", () => {
    const t = signCardToken(S, C, M, T0);
    expect(verifyCardToken(S, t, T0)).toEqual({ club: C, member: M });
    expect(verifyCardToken(S, t, new Date(T0.getTime() + 60_000))).toEqual({ club: C, member: M });
  });
  it("expires after about two minutes and is not valid from the future", () => {
    const t = signCardToken(S, C, M, T0);
    expect(verifyCardToken(S, t, new Date(T0.getTime() + 120_000))).toBeNull();
    expect(verifyCardToken(S, t, new Date(T0.getTime() - 120_000))).toBeNull();
  });
  it("rejects tampering: another member, another club, another secret, a changed signature", () => {
    const t = signCardToken(S, C, M, T0);
    const other = "33333333-3333-4333-8333-333333333333";
    expect(verifyCardToken(S, t.replace(M, other), T0)).toBeNull();
    expect(verifyCardToken(S, t.replace(C, other), T0)).toBeNull();
    expect(verifyCardToken("another-long-enough-secret-9999", t, T0)).toBeNull();
    expect(verifyCardToken(S, t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"), T0)).toBeNull();
  });
  it("never throws on garbage and refuses weak secrets", () => {
    for (const g of [undefined, null, 5, "", "rx1", "rx1.a.b.c.d", "x".repeat(500), "rx2.a.b.c.d", `rx1.${C}.${M}.zzzzzzzzzzzz.x`]) expect(verifyCardToken(S, g, T0)).toBeNull();
    expect(() => signCardToken("short", C, M, T0)).toThrow();
    expect(() => signCardToken(S, "nope", M, T0)).toThrow();
    expect(verifyCardToken("short", signCardToken(S, C, M, T0), T0)).toBeNull();
  });
});
