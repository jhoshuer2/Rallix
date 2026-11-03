import { describe, expect, it } from "vitest";
import { canChangeClubStatus, initialClubStatus, isClubStatus } from "./club-status";

describe("club status rules", () => {
  it("lets a pending club only be approved or declined", () => {
    expect(canChangeClubStatus("pending", "active")).toBe(true);
    expect(canChangeClubStatus("pending", "closed")).toBe(true);
    expect(canChangeClubStatus("pending", "suspended")).toBe(false);
  });
  it("lets an active club be suspended or closed, and a suspended or closed one come back", () => {
    expect(canChangeClubStatus("active", "suspended")).toBe(true);
    expect(canChangeClubStatus("active", "closed")).toBe(true);
    expect(canChangeClubStatus("suspended", "active")).toBe(true);
    expect(canChangeClubStatus("closed", "active")).toBe(true);
    expect(canChangeClubStatus("active", "pending")).toBe(false); // a live club never goes back to pending
    expect(canChangeClubStatus("closed", "suspended")).toBe(false);
  });
  it("refuses no-op and unknown changes", () => {
    expect(canChangeClubStatus("active", "active")).toBe(false);
    expect(canChangeClubStatus("active", "gone")).toBe(false);
    expect(canChangeClubStatus(undefined, "active")).toBe(false);
    expect(isClubStatus("pending")).toBe(true);
    expect(isClubStatus("PENDING")).toBe(false);
  });
  it("starts a new club pending only when approval is on", () => {
    expect(initialClubStatus(true)).toBe("pending");
    expect(initialClubStatus(false)).toBe("active");
  });
});
