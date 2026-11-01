import { and, eq, sql } from "drizzle-orm";
import { clubs, invoicePayments, platformInvoices, users } from "@rallix/db";
import { isPayTokenShape } from "@rallix/payments";
import { serviceDb } from "./db";

export type PayLinkState = "payable" | "paid" | "void" | "invalid";
export type PayLinkView = { state: PayLinkState; clubName?: string; number?: string; periodLabel?: string; description?: string | null; amountKobo?: number; paidAt?: Date | null; invoiceId?: string; clubId?: string };

/**
 * Look up an invoice by its public token. Shows only what the payer needs: club name, invoice number, period, amount.
 * No owner name, phone or email ever leaves this function. A bad, unknown, or disabled token all look identical ("invalid").
 */
export async function lookupPayLink(token: unknown): Promise<PayLinkView> {
  if (!isPayTokenShape(token)) return { state: "invalid" };
  const [r] = await serviceDb().select({
    invoiceId: platformInvoices.id, clubId: platformInvoices.clubId, status: platformInvoices.status, number: platformInvoices.number, periodLabel: platformInvoices.periodLabel,
    description: platformInvoices.description, amountKobo: platformInvoices.amountKobo, paidAt: platformInvoices.paidAt, clubName: clubs.name,
  }).from(platformInvoices).innerJoin(clubs, eq(clubs.id, platformInvoices.clubId)).where(eq(platformInvoices.payToken, token));
  if (!r) return { state: "invalid" };
  const base = { clubName: r.clubName, number: r.number, periodLabel: r.periodLabel, description: r.description, amountKobo: r.amountKobo, paidAt: r.paidAt, invoiceId: r.invoiceId, clubId: r.clubId };
  if (r.status === "issued") return { state: "payable", ...base };
  if (r.status === "paid") return { state: "paid", ...base };
  if (r.status === "void") return { state: "void", ...base };
  return { state: "invalid" }; // drafts are not payable and not revealed
}

/** Where the receipt/contact email defaults to when the payer gives none: the club owner's address, kept server-side. */
export async function ownerEmail(clubId: string): Promise<string> {
  const [o] = await serviceDb().select({ email: users.email }).from(clubs).innerJoin(users, eq(users.id, clubs.ownerId)).where(eq(clubs.id, clubId));
  return o?.email ?? "billing@rallix.app";
}

export const attemptsLastHour = async (invoiceId: string) =>
  Number(((await serviceDb().execute(sql`select count(*)::int as n from invoice_payments where invoice_id = ${invoiceId} and via_link and created_at > now() - interval '1 hour'`)).rows[0] as { n: number }).n);

/** Does this payment reference belong to the invoice behind the token? Stops a token holder from reading other payments. */
export async function referenceBelongsToToken(reference: string, token: unknown): Promise<boolean> {
  if (!isPayTokenShape(token)) return false;
  const [r] = await serviceDb().select({ id: invoicePayments.id }).from(invoicePayments).innerJoin(platformInvoices, eq(platformInvoices.id, invoicePayments.invoiceId))
    .where(and(eq(invoicePayments.reference, reference), eq(platformInvoices.payToken, token)));
  return !!r;
}

/** Best-effort per-IP limiter (in memory, per server instance). The per-invoice database limit is the real guard. */
const hits = new Map<string, number[]>();
export function ipAllowed(ip: string, max = 30, windowMs = 3600_000): boolean {
  const now = Date.now(), list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
