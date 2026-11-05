import { describe, expect, it } from "vitest";
import { isPushEndpoint, safeNext } from "./safe-input";

describe("safeNext", () => {
  it("keeps ordinary paths", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/play/calendar?x=1")).toBe("/play/calendar?x=1");
    expect(safeNext("/competition/abc/score?match=1")).toBe("/competition/abc/score?match=1");
  });
  it("replaces anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com", "javascript:alert(1)", "/\u0000x", "", undefined, null, 5, "/" + "a".repeat(600)]) expect(safeNext(bad)).toBe("/");
  });
});

describe("isPushEndpoint", () => {
  it("accepts the real push services", () => {
    for (const ok of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://wns2-par02p.notify.windows.com/w/?token=x", "https://web.push.apple.com/QWxs"]) expect(isPushEndpoint(ok)).toBe(true);
  });
  it("refuses everything else, including internal addresses and look-alikes", () => {
    for (const bad of ["http://fcm.googleapis.com/x", "https://internal-host/x", "https://localhost/x", "https://127.0.0.1/x", "https://169.254.169.254/latest/meta-data", "https://fcm.googleapis.com.evil.com/x", "https://evil.com/fcm.googleapis.com", "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://notify.windows.com.evil.io/x", 5, null]) expect(isPushEndpoint(bad)).toBe(false);
  });
});
