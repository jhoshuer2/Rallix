"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditLog, clubs, dues, invoicePayments, payments, platformInvoices, users } from "@rallix/db";
import { generateReference, isPaymentError } from "@rallix/payments";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { attemptsLastHour, ipAllowed, lookupPayLink, ownerEmail } from "./pay-link";
import { inClub, isAdmin, requireClub } from "./context";
import { serviceDb } from "./db";
import { appUrl, provider } from "./payments";
import { invoiceCols } from "./payment-queries";
import { recentAttempts } from "./payments-core";

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Paystack needs an email on every payment. Every account has a real one now, so receipts reach the payer. */
async function payerEmail(userId: string): Promise<string> {
  const [u] = await serviceDb().select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (!u) throw new Error("Unknown user");
  return u.email;
}
const friendly = (e: unknown) => (isPaymentError(e) && e.code !== "config" ? e.message : "Payments are unavailable right now. Please try again shortly.");

/* ---------- Player dues ---------- */

/** Start paying MY due online. The amount always comes from the database, never from the browser. */
export async function startDuePayment(dueId: string): Promise<Res<{ url: string }>> {
  const ctx = await requireClub();
  if (!UUID.test(dueId)) return fail("Invalid request.");
  const found = await inClub(ctx, async (tx) => {
    const [due] = await tx.select().from(dues).where(eq(dues.id, dueId));
    const [club] = await tx.select({ enabled: clubs.payoutsEnabledAt }).from(clubs).where(eq(clubs.id, ctx.club.clubId));
    return { due, enabled: !!club?.enabled };
  });
  const due = found.due;
  if (!due || due.membershipId !== ctx.club.membershipId) return fail("That payment was not found."); // admins can read every due but only pay their own
  if (due.status !== "due" && due.status !== "overdue") return fail("This is already paid.");
  if (!found.enabled) return fail("Your club has not set up online payments yet. Please pay your club admin directly.");
  if (due.amountKobo < 100) return fail("There is nothing to pay.");
  if ((await recentAttempts(due.id)) >= 5) return fail("Too many attempts. Please wait a few minutes and try again.");

  const svc = serviceDb();
  const [club] = await svc.select({ code: clubs.paystackSubaccountCode }).from(clubs).where(eq(clubs.id, ctx.club.clubId));
  if (!club?.code) return fail("Online payments are not available for this club.");
  const email = await payerEmail(ctx.user.id);

  const reference = generateReference("D");
  // Record what we expect to be paid BEFORE the customer leaves, so reconciliation compares against our own record.
  await inClub(ctx, (tx) => tx.insert(payments).values({ clubId: ctx.club.clubId, membershipId: ctx.club.membershipId, dueId: due.id, amountKobo: due.amountKobo, status: "pending", provider: provider().name, providerRef: reference }));
  try {
    const r = await provider().initializeTransaction({
      reference, amountKobo: due.amountKobo, email, callbackUrl: `${appUrl()}/pay/return?reference=${reference}`,
      subaccount: club.code, bearer: "subaccount", metadata: { kind: "due", dueId: due.id, clubId: ctx.club.clubId, membershipId: ctx.club.membershipId },
    });
    return { ok: true, url: r.authorizationUrl };
  } catch (e) {
    await svc.update(payments).set({ status: "failed" }).where(eq(payments.providerRef, reference));
    return fail(friendly(e));
  }
}

/** Admin records money received outside the app (cash or bank transfer). */
export async function recordManualPayment(input: { dueId: string; method: "cash" | "transfer" }): Promise<Res> {
  const ctx = await requireClub();
  if (!isAdmin(ctx.club)) return fail("Only club admins can record payments.");
  if (!UUID.test(input.dueId) || !["cash", "transfer"].includes(input.method)) return fail("Invalid request.");
  const done = await inClub(ctx, async (tx) => {
    const [due] = await tx.select().from(dues).where(eq(dues.id, input.dueId));
    if (!due) return "That due was not found.";
    if (due.status === "paid") return "That due is already paid.";
    await tx.insert(payments).values({ clubId: ctx.club.clubId, membershipId: due.membershipId, dueId: due.id, amountKobo: due.amountKobo, status: "paid", provider: "manual", providerRef: `manual-${randomUUID()}`, method: input.method, paidAt: new Date() });
    await tx.update(dues).set({ status: "paid" }).where(eq(dues.id, due.id));
    return null;
  });
  if (done) return fail(done);
  revalidatePath("/membership/payments");
  return { ok: true };
}

/* ---------- Club subscription (Rallix invoices) ---------- */

export async function startInvoicePayment(invoiceId: string): Promise<Res<{ url: string }>> {
  const ctx = await requireClub();
  if (!isAdmin(ctx.club)) return fail("Only club admins can pay invoices.");
  if (!UUID.test(invoiceId)) return fail("Invalid request.");
  const [inv] = await inClub(ctx, (tx) => tx.select(invoiceCols).from(platformInvoices).where(and(eq(platformInvoices.id, invoiceId), eq(platformInvoices.clubId, ctx.club.clubId))));
  if (!inv) return fail("That invoice was not found.");
  if (inv.status !== "issued") return fail(inv.status === "paid" ? "This invoice is already paid." : "This invoice can't be paid right now.");
  const svc = serviceDb();
  const email = await payerEmail(ctx.user.id);
  const reference = generateReference("I");
  await svc.insert(invoicePayments).values({ invoiceId: inv.id, clubId: inv.clubId, reference, amountKobo: inv.amountKobo, initiatedBy: ctx.user.id });
  try {
    const r = await provider().initializeTransaction({ reference, amountKobo: inv.amountKobo, email, callbackUrl: `${appUrl()}/pay/return?reference=${reference}`, metadata: { kind: "invoice", invoiceId: inv.id, clubId: inv.clubId } });
    return { ok: true, url: r.authorizationUrl };
  } catch (e) {
    await svc.update(invoicePayments).set({ status: "failed" }).where(eq(invoicePayments.reference, reference));
    return fail(friendly(e));
  }
}

/* ---------- Club payout account ---------- */

export async function loadBanks(): Promise<Res<{ banks: Array<{ name: string; code: string }> }>> {
  const ctx = await requireClub();
  if (!isAdmin(ctx.club)) return fail("Only club admins can set up payouts.");
  try { return { ok: true, banks: await provider().listBanks() }; } catch (e) { return fail(friendly(e)); }
}

export async function resolvePayoutAccount(input: { bankCode: string; accountNumber: string }): Promise<Res<{ accountName: string }>> {
  const ctx = await requireClub();
  if (!isAdmin(ctx.club)) return fail("Only club admins can set up payouts.");
  if (!/^\d{10}$/.test(input.accountNumber)) return fail("Account numbers have 10 digits.");
  try {
    if (!(await provider().listBanks()).some((b) => b.code === input.bankCode)) return fail("Choose a bank from the list.");
    return { ok: true, ...(await provider().resolveAccount(input)) };
  } catch (e) { return fail(isPaymentError(e) && e.code === "not_found" ? "We could not find that account. Check the number and bank." : friendly(e)); }
}

/** Create the club's settlement subaccount. The account name is re-resolved here, never trusted from the browser. */
export async function savePayoutAccount(input: { bankCode: string; accountNumber: string; confirmedName: string }): Promise<Res> {
  const ctx = await requireClub();
  if (!isAdmin(ctx.club)) return fail("Only club admins can set up payouts.");
  if (!/^\d{10}$/.test(input.accountNumber)) return fail("Account numbers have 10 digits.");
  try {
    const bank = (await provider().listBanks()).find((b) => b.code === input.bankCode);
    if (!bank) return fail("Choose a bank from the list.");
    const { accountName } = await provider().resolveAccount({ accountNumber: input.accountNumber, bankCode: input.bankCode });
    if (accountName.trim().toUpperCase() !== input.confirmedName.trim().toUpperCase()) return fail("The account details changed. Please verify the account again.");
    const sub = await provider().createSubaccount({ businessName: ctx.club.name, bankCode: input.bankCode, accountNumber: input.accountNumber });
    const last4 = input.accountNumber.slice(-4);
    const svc = serviceDb();
    await svc.update(clubs).set({ paystackSubaccountCode: sub.subaccountCode, payoutBankName: bank.name, payoutBankCode: bank.code, payoutAccountName: accountName, payoutAccountLast4: last4, payoutsEnabledAt: new Date() }).where(eq(clubs.id, ctx.club.clubId));
    await svc.insert(auditLog).values({ actorId: ctx.user.id, action: "club.payout_setup", entity: "club", entityId: ctx.club.clubId, meta: { bank: bank.name, last4 } });
    revalidatePath("/membership", "layout");
    return { ok: true };
  } catch (e) { return fail(isPaymentError(e) && e.code === "not_found" ? "We could not find that account." : friendly(e)); }
}

/* ---------- Public pay link (no sign-in) ---------- */

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** Start paying an issued Rallix invoice from its public link. The amount comes from the database, never from the page. */
export async function startInvoicePaymentByToken(token: string, email: string): Promise<Res<{ url: string }>> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  if (!ipAllowed(ip)) return fail("Too many attempts. Please wait a while and try again.");
  const cleanEmail = email.trim();
  if (cleanEmail && !EMAIL.test(cleanEmail)) return fail("That email address doesn't look right.");
  const link = await lookupPayLink(token);
  if (link.state === "paid") return fail("This invoice has already been paid. Thank you!");
  if (link.state !== "payable" || !link.invoiceId || !link.clubId || !link.amountKobo) return fail("This payment link is no longer valid. Please ask Rallix for a new one.");
  if ((await attemptsLastHour(link.invoiceId)) >= 5) return fail("Too many attempts for this invoice. Please wait an hour or contact Rallix.");

  const svc = serviceDb();
  const reference = generateReference("I");
  const payer = cleanEmail || (await ownerEmail(link.clubId));
  await svc.insert(invoicePayments).values({ invoiceId: link.invoiceId, clubId: link.clubId, reference, amountKobo: link.amountKobo, viaLink: true, payerEmail: cleanEmail || null });
  try {
    const r = await provider().initializeTransaction({ reference, amountKobo: link.amountKobo, email: payer, callbackUrl: `${appUrl()}/pay/invoice/${token}/return?reference=${reference}`, metadata: { kind: "invoice", invoiceId: link.invoiceId, clubId: link.clubId, viaLink: 1 } });
    return { ok: true, url: r.authorizationUrl };
  } catch (e) {
    await svc.update(invoicePayments).set({ status: "failed" }).where(eq(invoicePayments.reference, reference));
    return fail(friendly(e));
  }
}
