import Link from "next/link";
import { PageShell, Panel, SectionTitle, StackedBar, TileLink } from "@rallix/ui";
import { membershipOverview } from "@rallix/stats";
import { todayInClub } from "../../../lib/highlights";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requireRole } from "../../../lib/context";
import { payoutDetails } from "../../../lib/payment-queries";
import { listDues, naira, revenue } from "../../../lib/queries";
import { Revenue } from "./Revenue";

export default async function Membership() {
  const ctx = await requireRole("admin");
  const periods = ["Today", "Week", "Month", "Year"] as const;
  const data = await inClub(ctx, async (tx) => Object.fromEntries(await Promise.all(periods.map(async (p) => {
    const r = await revenue(tx, ctx.club.clubId, p);
    return [p, { amount: naira(r.total), bars: r.bars.map((b) => Math.round(b / 100)) }];
  }))));
  const dues = await inClub(ctx, (tx) => listDues(tx, ctx.club.clubId));
  const ov = membershipOverview(dues, todayInClub());
  const hasRevenue = periods.some((p) => (data as Record<string, { bars: number[] }>)[p]!.bars.some((b) => b > 0));
  const payout = await payoutDetails(ctx);
  return (
    <PageShell header={<ClubHeader />} title="Fees">
      {hasRevenue ? <Revenue data={data as Record<string, { amount: string; bars: number[] }>} /> : null}
      {ov.total > 0 ? (
        <>
          <SectionTitle title="Who has paid" href="/membership/payments" linkAs={Link} label="See all payments" />
          <Panel><StackedBar label="Membership status" parts={[{ label: "paid", value: ov.paid, tone: "good" }, { label: "expiring", value: ov.expiring, tone: "warn" }, { label: "unpaid", value: ov.unpaid, tone: "bad" }]} /></Panel>
        </>
      ) : null}
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
        <TileLink icon="tag" label="Fee plans" href="/membership/subscriptions" linkAs={Link} />
        <TileLink icon="calendar" label="Reminders" href="/membership/reminders" linkAs={Link} />
        <TileLink icon="money" label="Your Rallix plan" href="/membership/rallix" linkAs={Link} />
      </div>
    </PageShell>
  );
}
