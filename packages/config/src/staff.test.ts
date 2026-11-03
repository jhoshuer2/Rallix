import { describe, expect, it } from "vitest";
import { AREAS, STAFF_ROLES, staffCan, isStaffRole } from "./staff";

describe("staffCan", () => {
  it("lets the owner do everything and the admin everything except the team", () => {
    for (const a of AREAS) expect(staffCan("owner", a)).toBe(true);
    for (const a of AREAS) expect(staffCan("admin", a)).toBe(a !== "team");
  });
  it("keeps finance to money and support to issues, both able to look at clubs", () => {
    expect(AREAS.filter((a) => staffCan("finance", a))).toEqual(["clubs", "clubs_manage", "billing"]);
    expect(AREAS.filter((a) => staffCan("support", a))).toEqual(["clubs", "support"]);
    expect(staffCan("support", "clubs_manage")).toBe(false);
    expect(staffCan("support", "billing")).toBe(false);
    expect(staffCan("finance", "support")).toBe(false);
  });
  it("only the owner reaches the team page", () => {
    expect(STAFF_ROLES.filter((r) => staffCan(r, "team"))).toEqual(["owner"]);
  });
  it("fails closed for unknown roles", () => {
    for (const r of [undefined, null, "", "root", "OWNER", 5]) { expect(isStaffRole(r)).toBe(false); expect(staffCan(r, "clubs")).toBe(false); }
  });
});
