import Link from "next/link";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { VenueSetup } from "../../../../components/VenueSetup";
import { getVenue } from "../../../../lib/arrival-queries";
import { inClub, requirePermission } from "../../../../lib/context";

export const dynamic = "force-dynamic";

/** Where players check in. Whoever looks after the facilities marks the court once, standing there. */
export default async function Court() {
  const ctx = await requirePermission("facilities");
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Court and check-in">
      <Panel title="Court location"><VenueSetup venue={await inClub(ctx, (tx) => getVenue(tx, ctx.club.clubId))} /></Panel>
    </PageShell>
  );
}
