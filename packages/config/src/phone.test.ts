import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("accepts the common Nigerian formats", () => {
    for (const p of ["08031112222", "0803 111 2222", "+2348031112222", "2348031112222", "(0803) 111-2222"]) expect(normalizePhone(p)).toBe("+2348031112222");
  });
  it("rejects bad numbers", () => {
    for (const p of ["", "0803111222", "080311122223", "+1 415 555 0100", "0603 111 2222", "abc", "+23480311122229"]) expect(normalizePhone(p)).toBeNull();
  });
});
