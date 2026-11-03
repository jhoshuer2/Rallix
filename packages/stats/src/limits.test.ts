import { describe, expect, it } from "vitest";
import { limitLabel, memberLimitState } from "./index";

describe("memberLimitState", () => {
  it("has no limit, never full, never nearing", () => {
    expect(memberLimitState(500, null)).toEqual({ limit: null, members: 500, left: null, full: false, nearing: false });
    expect(limitLabel(memberLimitState(5, null))).toBeNull();
  });
  it("is nearing when five or fewer places are left, full at the limit or beyond", () => {
    expect(memberLimitState(44, 50)).toMatchObject({ left: 6, nearing: false, full: false });
    expect(memberLimitState(45, 50)).toMatchObject({ left: 5, nearing: true, full: false });
    expect(memberLimitState(49, 50)).toMatchObject({ left: 1, nearing: true });
    expect(memberLimitState(50, 50)).toMatchObject({ left: 0, nearing: false, full: true });
    expect(memberLimitState(55, 50)).toMatchObject({ left: 0, full: true }); // over the limit (a plan was downgraded)
  });
  it("writes the label", () => {
    expect(limitLabel(memberLimitState(45, 50))).toBe("45 of 50 members");
  });
});
