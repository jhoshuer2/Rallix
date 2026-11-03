import { and, desc, eq } from "drizzle-orm";
import { clubSubscriptions, clubs, platformInvoices } from "@rallix/db";
import { inClub, can, type Ctx, type MyClub } from "./context";
import { serviceDb } from "./db";

type C = Ctx & { club: MyClub };

/** Players and admins may know whether online payments are on, nothing more. */
export const payoutsEnabled = async (ctx: C) =>
  !!(await inClub(ctx, (tx) => tx.select({ at: clubs.payoutsEnabledAt }).from(clubs).where(eq(clubs.id, ctx.club.clubId))))[0]?.at;

/** Bank details are service-only. Call this only after the caller is known to be an admin of this club. */
export async function payoutDetails(ctx: C) {
  if (!can(ctx.club, "finance")) return null;
  const [r] = await serviceDb().select({ enabledAt: clubs.payoutsEnabledAt, bank: clubs.payoutBankName, name: clubs.payoutAccountName, last4: clubs.payoutAccountLast4 }).from(clubs).where(eq(clubs.id, ctx.club.clubId));
  return r?.enabledAt ? r : null;
}

/** Columns the app role may read. pay_token is deliberately absent: the database denies it. */
export const invoiceCols = { id: platformInvoices.id, clubId: platformInvoices.clubId, number: platformInvoices.number, status: platformInvoices.status, amountKobo: platformInvoices.amountKobo, periodLabel: platformInvoices.periodLabel, description: platformInvoices.description, issuedAt: platformInvoices.issuedAt, dueAt: platformInvoices.dueAt, paidAt: platformInvoices.paidAt };

export async function rallixBilling(ctx: C) {
  return inClub(ctx, async (tx) => ({
    subscription: (await tx.select().from(clubSubscriptions).where(eq(clubSubscriptions.clubId, ctx.club.clubId)).orderBy(desc(clubSubscriptions.createdAt)).limit(1))[0] ?? null,
    invoices: await tx.select(invoiceCols).from(platformInvoices).where(and(eq(platformInvoices.clubId, ctx.club.clubId))).orderBy(desc(platformInvoices.createdAt)).limit(24),
  }));
}
