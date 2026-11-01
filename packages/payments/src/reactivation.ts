export type ReactivationInput = {
  clubStatus: "active" | "suspended" | "closed";
  suspensionReason: "non_payment" | "other" | null;
  /** Issued invoices for this club that are still unpaid AFTER the one just paid, with their due dates. */
  otherUnpaidInvoices: Array<{ dueAt: Date | null }>;
  now: Date;
};

/**
 * A club comes back automatically only when ALL of these hold:
 *  - it is suspended (never reactivate an active or closed club)
 *  - it was suspended for non-payment (a club suspended for misconduct must wait for a human)
 *  - nothing else is overdue. Invoices not yet due do not block it; ones with no due date are treated as overdue.
 */
export function shouldReactivate(i: ReactivationInput): boolean {
  if (i.clubStatus !== "suspended" || i.suspensionReason !== "non_payment") return false;
  return i.otherUnpaidInvoices.every((inv) => inv.dueAt !== null && inv.dueAt.getTime() > i.now.getTime());
}
