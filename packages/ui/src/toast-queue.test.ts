import { describe, expect, it } from "vitest";
import { MAX_TOASTS, dismissToast, pushToast, toastSeconds } from "./toast-queue";

describe("toast queue", () => {
  it("adds in order and keeps only the newest few", () => {
    let l = pushToast([], { tone: "success", message: "a" }, 1);
    l = pushToast(l, { tone: "success", message: "b" }, 2);
    l = pushToast(l, { tone: "error", message: "c" }, 3);
    l = pushToast(l, { tone: "info", message: "d" }, 4);
    expect(l.map((t) => t.message)).toEqual(["b", "c", "d"]);
    expect(l).toHaveLength(MAX_TOASTS);
  });
  it("shows the same message once: a repeat replaces the old one with a fresh toast (new id, full time again)", () => {
    const l = pushToast([], { tone: "success", message: "Saved." }, 1);
    const again = pushToast(l, { tone: "success", message: "Saved." }, 2);
    expect(again).toHaveLength(1);
    expect(again[0]!.id).toBe(2);
    expect(pushToast(l, { tone: "error", message: "Saved." }, 3)).toHaveLength(2); // a different tone is a different message
  });
  it("dismisses one by id", () => {
    const l = pushToast(pushToast([], { tone: "success", message: "a" }, 1), { tone: "success", message: "b" }, 2);
    expect(dismissToast(l, 1).map((t) => t.message)).toEqual(["b"]);
    expect(dismissToast(l, 99)).toHaveLength(2);
  });
  it("a failure stays longer than a success", () => {
    expect(toastSeconds("success")).toBe(6);
    expect(toastSeconds("info")).toBe(6);
    expect(toastSeconds("error")).toBe(10);
  });
});
