"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { facilityItems, facilityLog } from "@rallix/db";
import { inClub, requirePermission } from "./context";
import { recentLog, type LogLine } from "./facility-queries";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ["table", "bat", "ball", "net", "other"], STATUSES = ["ok", "needs_attention", "out"];
const WHY: Record<string, string> = { negative: "There aren’t that many in stock.", invalid: "Enter a whole number.", unknown: "That item no longer exists.", denied: "You can’t change facilities." };

export interface ItemInput { kind: string; name: string; quantity: number; minQuantity?: number | null; status: string; note?: string }

function clean(i: ItemInput) {
  if (!KINDS.includes(i?.kind)) return fail("Choose what it is.");
  const name = String(i.name ?? "").trim();
  if (name.length < 1 || name.length > 80) return fail("Give it a short name (up to 80 characters).");
  const quantity = Number(i.quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) return fail("How many? Enter a whole number.");
  const min = i.minQuantity === null || i.minQuantity === undefined || (i.minQuantity as unknown) === "" ? null : Number(i.minQuantity);
  if (min !== null && (!Number.isInteger(min) || min < 0 || min > 100000)) return fail("The warning level must be a whole number.");
  if (!STATUSES.includes(i.status)) return fail("Choose a condition.");
  const note = String(i.note ?? "").trim().slice(0, 280) || null;
  return { ok: true as const, v: { kind: i.kind, name, quantity, minQuantity: min, status: i.status, note } };
}

export async function saveFacilityItem(id: string | null, input: ItemInput): Promise<Result> {
  const ctx = await requirePermission("facilities");
  const c = clean(input);
  if (!c.ok) return c;
  if (id !== null && !UUID.test(String(id))) return fail(WHY.unknown!);
  const n = await inClub(ctx, async (tx) => {
    if (id) return (await tx.update(facilityItems).set({ ...c.v, updatedAt: new Date() }).where(and(eq(facilityItems.id, id), eq(facilityItems.clubId, ctx.club.clubId))).returning({ id: facilityItems.id })).length;
    await tx.insert(facilityItems).values({ ...c.v, clubId: ctx.club.clubId });
    return 1;
  });
  if (!n) return fail(WHY.unknown!);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteFacilityItem(id: string): Promise<Result> {
  const ctx = await requirePermission("facilities");
  if (!UUID.test(String(id))) return fail(WHY.unknown!);
  await inClub(ctx, (tx) => tx.delete(facilityItems).where(and(eq(facilityItems.id, id), eq(facilityItems.clubId, ctx.club.clubId))));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Change a stock count by `delta` (logged in the same step by the database; never below zero). */
export async function adjustStock(id: string, delta: number, note?: string): Promise<Result> {
  const ctx = await requirePermission("facilities");
  if (!UUID.test(String(id))) return fail(WHY.unknown!);
  const d = Number(delta);
  if (!Number.isInteger(d) || d === 0) return fail(WHY.invalid!);
  const code = await inClub(ctx, async (tx) => String((await tx.execute(sql`select app.adjust_stock(${id}::uuid, ${d}, ${String(note ?? "").trim().slice(0, 280) || null}) as r`)).rows[0]?.r));
  if (code !== "ok") return fail(WHY[code] ?? "Something went wrong.");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** A line in the upkeep history ("Replaced the net"). Can also set the condition in the same step. */
export async function logMaintenance(id: string, note: string, status?: string): Promise<Result> {
  const ctx = await requirePermission("facilities");
  if (!UUID.test(String(id))) return fail(WHY.unknown!);
  const text = String(note ?? "").trim();
  if (text.length < 1 || text.length > 280) return fail("Write a short note (up to 280 characters).");
  if (status !== undefined && !STATUSES.includes(status)) return fail("Choose a condition.");
  const n = await inClub(ctx, async (tx) => {
    const [item] = await tx.select({ id: facilityItems.id }).from(facilityItems).where(and(eq(facilityItems.id, id), eq(facilityItems.clubId, ctx.club.clubId))).limit(1);
    if (!item) return 0;
    await tx.insert(facilityLog).values({ clubId: ctx.club.clubId, itemId: id, kind: "maintenance", note: text, createdBy: ctx.club.membershipId });
    if (status) await tx.update(facilityItems).set({ status, updatedAt: new Date() }).where(eq(facilityItems.id, id));
    return 1;
  });
  if (!n) return fail(WHY.unknown!);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The latest lines for one item, for the sheet. */
export async function itemHistory(id: string): Promise<LogLine[]> {
  const ctx = await requirePermission("facilities");
  if (!UUID.test(String(id))) return [];
  return inClub(ctx, (tx) => recentLog(tx, ctx.club.clubId, id, 5));
}
