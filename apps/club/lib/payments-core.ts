import { and, eq, inArray, sql } from "drizzle-orm";
import { auditLog, clubSubscriptions, clubs, dues, invoicePayments, paymentEvents, payments, platformInvoices } from "@rallix/db";
import { reconcile, referenceKind, shouldReactivate } from "@rallix/payments";
import { serviceDb } from "./db";
import { provider } from "./payments";

/**
 * The ONE place money is credited. Every path (webhook, return page) ends here.
 * Rules, in order:
 *  1. The reference must be one we created and recorded BEFORE the customer paid.
 *  2. We never trust the caller's claim: we ask the provider, then reconcile reference, amount, currency and status
 *     against OUR recorded amount.
 *  3. Crediting happens in one transaction under a row lock and is idempotent: a replay changes nothing.
 * Uses the service role because webhooks have no signed-in user; callers must only reach it with a reference.
 */
export type Outcome = "credited" | "already_processed" | "duplicate_payment" | "still_pending" | "failed" | "rejected_mismatch" | "unknown_reference";
export type Finalised = { outcome: Outcome; kind: "due" | "invoice" | null; detail?: string };

export async function logEvent(e: { event: string; reference: string | null; signatureValid: boolean; outcome: string; detail?: string; raw?: unknown }) {
  try {
    await serviceDb().insert(paymentEvents).values({
      provider: provider().name, event: e.event, reference: e.reference, signatureValid: e.signatureValid, outcome: e.outcome,
      detail: e.detail?.slice(0, 500), raw: e.raw === undefined ? null : (JSON.parse(JSON.stringify(e.raw).slice(0, 8000).replace(/[\u0000-\u001f]/g, " ") || "null") as never),
    });
  } catch { /* logging must never break payment handling */ }
}

export async function finalizeByReference(reference: string): Promise<Finalised> {
  const kind = referenceKind(reference);
  if (kind === "due") return finalizeDue(reference);
  if (kind === "invoice") return finalizeInvoice(reference);
  return { outcome: "unknown_reference", kind: null };
}

type Verdict = { stop: Finalised } | { credit: Awaited<ReturnType<ReturnType<typeof provider>["verifyTransaction"]>> };

async function verdict(reference: string, expectedKobo: number, kind: "due" | "invoice", markFailed: () => Promise<unknown>): Promise<Verdict> {
  const v = await provider().verifyTransaction(reference); // throws on provider errors, so the webhook returns 500 and Paystack retries
  const rec = reconcile({ reference, amountKobo: expectedKobo }, v);
  if (rec.ok) return { credit: v };
  if (rec.reason === "not_successful") {
    if (v.status === "failed" || v.status === "abandoned") { await markFailed(); return { stop: { outcome: "failed", kind } }; }
    return { stop: { outcome: "still_pending", kind } };
  }
  return { stop: { outcome: "rejected_mismatch", kind, detail: rec.reason } };
}

async function finalizeDue(reference: string): Promise<Finalised> {
  const db = serviceDb();
  const [pay] = await db.select().from(payments).where(eq(payments.providerRef, reference));
  if (!pay) return { outcome: "unknown_reference", kind: "due" };
  if (pay.status === "paid") return { outcome: "already_processed", kind: "due" };
  if (pay.status === "refunded") return { outcome: "already_processed", kind: "due", detail: "refunded" };
  const d = await verdict(reference, pay.amountKobo, "due", () => db.update(payments).set({ status: "failed" }).where(and(eq(payments.id, pay.id), eq(payments.status, "pending"))));
  if ("stop" in d) return d.stop;
  const v = d.credit;
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(payments).where(eq(payments.id, pay.id)).for("update");
    if (!locked || !["pending", "failed"].includes(locked.status)) return { outcome: "already_processed", kind: "due" } as Finalised;
    await tx.update(payments).set({ status: "paid", method: v.channel, paidAt: v.paidAt ?? new Date(), raw: v.raw as never }).where(eq(payments.id, locked.id));
    if (!locked.dueId) return { outcome: "credited", kind: "due", detail: "no due attached" } as Finalised;
    const closed = await tx.update(dues).set({ status: "paid" }).where(and(eq(dues.id, locked.dueId), inArray(dues.status, ["due", "overdue"]))).returning({ id: dues.id });
    // The due was already settled (by cash, or a second payment). The money WAS taken, so keep the payment and flag it for a refund.
    return (closed.length ? { outcome: "credited", kind: "due" } : { outcome: "duplicate_payment", kind: "due", detail: "due was already paid" }) as Finalised;
  });
}

async function finalizeInvoice(reference: string): Promise<Finalised> {
  const db = serviceDb();
  const [ip] = await db.select().from(invoicePayments).where(eq(invoicePayments.reference, reference));
  if (!ip) return { outcome: "unknown_reference", kind: "invoice" };
  if (ip.status === "paid") return { outcome: "already_processed", kind: "invoice" };
  const d = await verdict(reference, ip.amountKobo, "invoice", () => db.update(invoicePayments).set({ status: "failed" }).where(and(eq(invoicePayments.id, ip.id), eq(invoicePayments.status, "pending"))));
  if ("stop" in d) return d.stop;
  const v = d.credit;
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(invoicePayments).where(eq(invoicePayments.id, ip.id)).for("update");
    if (!locked || !["pending", "failed"].includes(locked.status)) return { outcome: "already_processed", kind: "invoice" } as Finalised;
    const paidAt = v.paidAt ?? new Date();
    await tx.update(invoicePayments).set({ status: "paid", paidAt, raw: v.raw as never }).where(eq(invoicePayments.id, locked.id));
    const closed = await tx.update(platformInvoices).set({ status: "paid", paidAt, paymentRef: reference })
      .where(and(eq(platformInvoices.id, locked.invoiceId), eq(platformInvoices.status, "issued"))).returning({ id: platformInvoices.id, number: platformInvoices.number });
    if (!closed.length) return { outcome: "duplicate_payment", kind: "invoice", detail: "invoice was already paid or void" } as Finalised;
    await tx.update(clubSubscriptions).set({ status: "active" }).where(and(eq(clubSubscriptions.clubId, locked.clubId), eq(clubSubscriptions.status, "past_due")));
    await tx.insert(auditLog).values({ actorId: null, action: "invoice.paid_online", entity: "invoice", entityId: locked.invoiceId, meta: { number: closed[0]!.number, reference, provider: provider().name, viaLink: locked.viaLink } });

    // A club suspended for NON-PAYMENT comes back on its own once nothing else is overdue. Any other suspension waits for a human.
    const [club] = await tx.select({ status: clubs.status, reason: clubs.suspensionReason }).from(clubs).where(eq(clubs.id, locked.clubId)).for("update");
    if (club) {
      const others = await tx.select({ dueAt: platformInvoices.dueAt }).from(platformInvoices).where(and(eq(platformInvoices.clubId, locked.clubId), eq(platformInvoices.status, "issued")));
      if (shouldReactivate({ clubStatus: club.status, suspensionReason: club.reason, otherUnpaidInvoices: others, now: new Date() })) {
        await tx.update(clubs).set({ status: "active", suspensionReason: null }).where(eq(clubs.id, locked.clubId));
        await tx.insert(auditLog).values({ actorId: null, action: "club.reactivated_on_payment", entity: "club", entityId: locked.clubId, meta: { invoiceId: locked.invoiceId, reference } });
      }
    }
    return { outcome: "credited", kind: "invoice" } as Finalised;
  });
}

/** Count recent attempts for rate limiting. */
export const recentAttempts = async (dueId: string) =>
  Number(((await serviceDb().execute(sql`select count(*)::int as n from payments where due_id = ${dueId} and created_at > now() - interval '1 hour'`)).rows[0] as { n: number }).n);
