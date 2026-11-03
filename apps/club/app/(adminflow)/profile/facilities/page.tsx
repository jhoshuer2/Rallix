import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { inClub, requirePermission } from "../../../../lib/context";
import { listFacilityItems } from "../../../../lib/facility-queries";
import { FacilitiesManager } from "./FacilitiesManager";

export const dynamic = "force-dynamic";

/** What the club owns and looks after: tables, bats, balls, nets. Only the Facilities admin sees this. */
export default async function Facilities() {
  const ctx = await requirePermission("facilities");
  const items = await inClub(ctx, (tx) => listFacilityItems(tx, ctx.club.clubId));
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Facilities">
      <FacilitiesManager items={items} />
    </PageShell>
  );
}
