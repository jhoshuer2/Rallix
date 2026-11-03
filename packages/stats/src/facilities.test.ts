import { describe, expect, it } from "vitest";
import { facilitySummary, itemAlert, validAdjust, type FacilityItemLike } from "./index";

const it1 = (o: Partial<FacilityItemLike> = {}): FacilityItemLike => ({ kind: "ball", name: "Balls", quantity: 10, minQuantity: null, status: "ok", ...o });

describe("itemAlert", () => {
  it("ranks out of service above needs attention above low stock", () => {
    expect(itemAlert(it1({ status: "out", quantity: 0, minQuantity: 5 }))).toBe("out");
    expect(itemAlert(it1({ status: "needs_attention", quantity: 0, minQuantity: 5 }))).toBe("needs_attention");
    expect(itemAlert(it1({ quantity: 4, minQuantity: 5 }))).toBe("low");
  });
  it("is quiet when everything is fine, at the minimum, or no minimum is set", () => {
    expect(itemAlert(it1())).toBeNull();
    expect(itemAlert(it1({ quantity: 5, minQuantity: 5 }))).toBeNull();
    expect(itemAlert(it1({ quantity: 0, minQuantity: null }))).toBeNull();
  });
});

describe("facilitySummary and validAdjust", () => {
  it("counts tables in use and items needing attention", () => {
    const s = facilitySummary([it1({ kind: "table", name: "T1", quantity: 1 }), it1({ kind: "table", name: "T2", quantity: 1, status: "out" }), it1({ quantity: 2, minQuantity: 6 }), it1()]);
    expect(s).toEqual({ total: 4, needAttention: 2, tables: 2, tablesInUse: 1 });
    expect(facilitySummary([])).toEqual({ total: 0, needAttention: 0, tables: 0, tablesInUse: 0 });
  });
  it("accepts only whole, non-zero changes that stay within range", () => {
    expect(validAdjust(3, -3)).toBe(true);
    expect(validAdjust(3, -4)).toBe(false);
    expect(validAdjust(3, 0)).toBe(false);
    expect(validAdjust(3, 1.5)).toBe(false);
    expect(validAdjust(99999, 2)).toBe(false);
  });
});
