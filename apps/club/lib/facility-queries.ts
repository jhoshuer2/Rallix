import { asc, desc, eq } from "drizzle-orm";
import { facilityItems, facilityLog, memberships, users, type Tx } from "@rallix/db";
import { itemAlert, type ItemKind, type ItemStatus } from "@rallix/stats";

export type FacilityItem = { id: string; kind: ItemKind; name: string; quantity: number; minQuantity: number | null; status: ItemStatus; note: string | null };
export type LogLine = { id: string; kind: string; note: string | null; delta: number | null; by: string | null; at: Date };

export async function listFacilityItems(tx: Tx, clubId: string): Promise<FacilityItem[]> {
  const rows = await tx.select().from(facilityItems).where(eq(facilityItems.clubId, clubId)).orderBy(asc(facilityItems.kind), asc(facilityItems.name));
  return rows.map((r) => ({ id: r.id, kind: r.kind as ItemKind, name: r.name, quantity: r.quantity, minQuantity: r.minQuantity, status: r.status as ItemStatus, note: r.note }));
}

/** The latest few lines for one item, newest first, with the admin's name. */
export async function recentLog(tx: Tx, clubId: string, itemId: string, limit = 5): Promise<LogLine[]> {
  const rows = await tx.select({ id: facilityLog.id, kind: facilityLog.kind, note: facilityLog.note, delta: facilityLog.delta, by: users.name, at: facilityLog.createdAt })
    .from(facilityLog).leftJoin(memberships, eq(memberships.id, facilityLog.createdBy)).leftJoin(users, eq(users.id, memberships.userId))
    .where(eq(facilityLog.itemId, itemId)).orderBy(desc(facilityLog.createdAt)).limit(limit);
  void clubId;
  return rows;
}

export const attentionCount = (items: FacilityItem[]) => items.filter((i) => itemAlert(i) !== null).length;
