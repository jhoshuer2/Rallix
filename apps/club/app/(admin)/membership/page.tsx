import Link from "next/link";
import { PromoCard } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requireRole } from "../../../lib/context";
import { naira, revenue } from "../../../lib/queries";
import { Revenue } from "./Revenue";

export default async function Membership() {
  const ctx = await requireRole("admin");
  const periods = ["Today", "Week", "Month", "Year"] as const;
  const data = await inClub(ctx, async (tx) => Object.fromEntries(await Promise.all(periods.map(async (p) => {
    const r = await revenue(tx, ctx.club.clubId, p);
    return [p, { amount: naira(r.total), bars: r.bars.map((b) => Math.round(b / 100)) }];
  }))));
  return (
    <>
      <ClubHeader />
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Membership</h1>
      <Revenue data={data as Record<string, { amount: string; bars: number[] }>} />
      <PromoCard title="Manage your subscription" cta="Visit" href="/membership/subscriptions" linkAs={Link} />
      <PromoCard title="Manage membership" cta="View" href="/membership/payments" tone="green" linkAs={Link} />
    </>
  );
}
