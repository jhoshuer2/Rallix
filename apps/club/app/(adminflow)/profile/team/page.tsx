import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { inClub, requireRole } from "../../../../lib/context";
import { listTeam } from "../../../../lib/team";
import { TeamManager } from "./TeamManager";

export const dynamic = "force-dynamic";

/** Who runs the club and what each admin looks after. Everyone who is an admin can see it; only the owner can change it. */
export default async function Team() {
  const ctx = await requireRole("admin");
  const team = await inClub(ctx, (tx) => listTeam(tx, ctx.club.clubId));
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Admin team">
      <TeamManager admins={team.admins} others={team.others} meId={ctx.club.membershipId} canEdit={ctx.club.isOwner} />
    </PageShell>
  );
}
