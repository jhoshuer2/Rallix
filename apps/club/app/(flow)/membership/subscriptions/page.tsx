import Link from "next/link";
import { BackButton } from "@rallix/ui";
import { inClub, requireRole } from "../../../../lib/context";
import { listPlans } from "../../../../lib/queries";
import { Plans } from "./Plans";

export default async function Subscriptions() {
  const ctx = await requireRole("admin");
  const plans = await inClub(ctx, (tx) => listPlans(tx, ctx.club.clubId));
  return (
    <>
      <div style={{ marginBottom: 16 }}><BackButton href="/membership" linkAs={Link} /></div>
      <Plans plans={plans.map((p) => ({ id: p.id, name: p.name, priceKobo: p.priceKobo, period: p.period, perks: p.perks, active: p.active }))} />
    </>
  );
}
