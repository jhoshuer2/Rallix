import { describe, expect, it } from "vitest";
import { setupProgress, setupSteps, playerStart } from "./setup";

const none = { hasLogo: false, hasCover: false, hasCourt: false, hasPlans: false, hasPayouts: false, hasInvited: false, hasCompetition: false, hasClubPage: false, hasPassword: false };
describe("setupProgress", () => {
  it("starts at zero and points at the first step", () => {
    const p = setupProgress(none);
    expect(p).toMatchObject({ done: 0, total: 8, complete: false });
    expect(p.next?.key).toBe("picture");
  });
  it("counts a logo or a cover as the club picture", () => {
    expect(setupSteps({ ...none, hasCover: true }).find((s) => s.key === "picture")?.done).toBe(true);
    expect(setupSteps({ ...none, hasLogo: true }).find((s) => s.key === "picture")?.done).toBe(true);
  });
  it("moves the next step along as things are done", () => {
    expect(setupProgress({ ...none, hasLogo: true }).next?.key).toBe("clubpage");
    expect(setupProgress({ ...none, hasLogo: true, hasClubPage: true }).next?.key).toBe("invite");
    expect(setupProgress({ ...none, hasLogo: true, hasClubPage: true, hasInvited: true, hasPlans: true }).next?.key).toBe("payouts");
  });
  it("is complete when everything is done and has no next step", () => {
    const all = { hasLogo: true, hasCover: true, hasCourt: true, hasPlans: true, hasPayouts: true, hasInvited: true, hasCompetition: true, hasClubPage: true, hasPassword: true };
    expect(setupProgress(all)).toMatchObject({ done: 8, complete: true, next: null });
  });
  it("gives every step a place to go", () => { for (const s of setupSteps(none)) expect(s.href.startsWith("/")).toBe(true); });
});
describe("playerStart", () => {
  it("marks finished steps", () => {
    const s = playerStart({ hasPhoto: true, levelSet: true, playedMatch: false, alertsOn: false, hasPassword: false });
    expect(s.map((x) => x.done)).toEqual([true, false, false, false]);
  });
});

describe("account step", () => {
  it("is the last step for admins and players, and done once a password is set", () => {
    expect(setupSteps(none).at(-1)).toMatchObject({ key: "account", title: "Set a username and password", href: "/profile/account", done: false });
    expect(setupSteps({ ...none, hasPassword: true }).at(-1)?.done).toBe(true);
    expect(playerStart({ hasPhoto: false, levelSet: true, playedMatch: false, alertsOn: false, hasPassword: false }).at(-1)).toMatchObject({ key: "account", href: "/play/me/account", done: false });
  });
});
