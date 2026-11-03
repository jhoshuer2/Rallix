import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { inClub, requirePermission } from "../../../../lib/context";
import { listPlans } from "../../../../lib/queries";
import { Plans } from "./Plans";

export default async function Subscriptions() {
  const ctx = await requirePermission("finance");
  const plans = await inClub(ctx, (tx) => listPlans(tx, ctx.club.clubId));
  return (
    <PageShell back={<BackButton href="/membership" linkAs={Link} />} title="Plans">
      <Plans plans={plans.map((p) => ({ id: p.id, name: p.name, priceKobo: p.priceKobo, period: p.period, perks: p.perks, active: p.active }))} />
    </PageShell>
  );
}
