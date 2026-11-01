import Link from "next/link";
import { TileLink } from "@rallix/ui";
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
      <h1 className="rx-title" style={{ margin: "8px 0 16px" }}>Membership</h1>
      <Revenue data={data as Record<string, { amount: string; bars: number[] }>} />
      {payout ? (
        <div className="rx-payrow rx-payrow--on">
          <p><strong>Payouts on</strong><br />{payout.bank} ••{payout.last4}</p>
          <Link className="rx-btn rx-btn--small" href="/membership/payouts">Change</Link>
        </div>
      ) : (
        <div className="rx-payrow rx-payrow--off">
          <p><strong>Online payments are off</strong><br />Add a bank account so players can pay in the app.</p>
          <Link className="rx-btn rx-btn--small" href="/membership/payouts">Set up</Link>
        </div>
      )}
      <div className="rx-tilegrid">
        <TileLink icon="wallet" label="Payments" href="/membership/payments" linkAs={Link} />
        <TileLink icon="tag" label="Plans" href="/membership/subscriptions" linkAs={Link} />
        <TileLink icon="calendar" label="Reminders" href="/membership/reminders" linkAs={Link} />
        <TileLink icon="money" label="Rallix invoices" href="/membership/rallix" linkAs={Link} />
      </div>
    </>
  );
}
