/** Pure facilities rules. */
export type ItemKind = "table" | "bat" | "ball" | "net" | "other";
export type ItemStatus = "ok" | "needs_attention" | "out";
export interface FacilityItemLike { kind: ItemKind; name: string; quantity: number; minQuantity: number | null; status: ItemStatus }
export type ItemAlert = "out" | "needs_attention" | "low" | null;

/** Why an item needs the admin's eye, most serious first. */
export function itemAlert(i: Pick<FacilityItemLike, "quantity" | "minQuantity" | "status">): ItemAlert {
  if (i.status === "out") return "out";
  if (i.status === "needs_attention") return "needs_attention";
  if (i.minQuantity != null && i.quantity < i.minQuantity) return "low";
  return null;
}

export const ALERT_LABEL: Record<Exclude<ItemAlert, null>, string> = { out: "Out of service", needs_attention: "Needs attention", low: "Running low" };

export function facilitySummary(items: FacilityItemLike[]): { total: number; needAttention: number; tables: number; tablesInUse: number } {
  const tables = items.filter((i) => i.kind === "table");
  return {
    total: items.length,
    needAttention: items.filter((i) => itemAlert(i) !== null).length,
    tables: tables.reduce((n, t) => n + t.quantity, 0),
    tablesInUse: tables.filter((t) => t.status !== "out").reduce((n, t) => n + t.quantity, 0),
  };
}

/** A stock change must be a whole non-zero number that does not take the count below zero or above the cap. */
export function validAdjust(current: number, delta: number): boolean {
  return Number.isInteger(delta) && delta !== 0 && Math.abs(delta) <= 100000 && current + delta >= 0 && current + delta <= 100000;
}

export const KIND_LABEL: Record<ItemKind, string> = { table: "Tables", bat: "Bats", ball: "Balls", net: "Nets", other: "Other" };
export const KIND_ORDER: ItemKind[] = ["table", "bat", "ball", "net", "other"];
