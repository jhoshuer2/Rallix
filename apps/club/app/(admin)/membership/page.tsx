import Link from "next/link";
import { PromoCard } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requireRole } from "../../../lib/context";
import { payoutDetails } from "../../../lib/payment-queries";
import { naira, revenue } from "../../../lib/queries";
import { Revenue } from "./Revenue";

export default async function Membership() {
  const ctx = await requireRole("admin");
  const periods = ["Today", "Week", "Month", "Year"] as const;
  const data = await inClub(ctx, async (tx) => Object.fromEntries(await Promise.all(periods.map(async (p) => {
    const r = await revenue(tx, ctx.club.clubId, p);
    return [p, { amount: naira(r.total), bars: r.bars.map((b) => Math.round(b / 100)) }];
  }))));
  const payout = await payoutDetails(ctx);
  return (
    <>
      <ClubHeader />
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Membership</h1>
      <Revenue data={data as Record<string, { amount: string; bars: number[] }>} />
      <div className="rx-card" style={{ marginBottom: 16 }}>
        <strong>Online payments</strong>
        <p style={{ margin: "8px 0 12px" }}>{payout ? `Active. Dues settle to ${payout.bank} ••${payout.last4} (${payout.name}).` : "Not set up. Players can’t pay dues in the app until you add a bank account."}</p>
        <Link className="rx-btn rx-btn--small" href="/membership/payouts">{payout ? "Change account" : "Set up payouts"}</Link>
      </div>
      <PromoCard title="Manage your subscription" cta="Visit" href="/membership/subscriptions" linkAs={Link} />
      <PromoCard title="Manage membership" cta="View" href="/membership/payments" tone="green" linkAs={Link} />
      <div style={{ display: "grid", gap: 12 }}>
        <Link className="rx-btn rx-btn--ghost rx-btn--block" href="/membership/reminders">Dues reminders</Link>
        <Link className="rx-btn rx-btn--ghost rx-btn--block" href="/membership/rallix">Your Rallix subscription and invoices</Link>
      </div>
    </>
  );
}
