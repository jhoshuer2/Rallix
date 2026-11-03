import Link from "next/link";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { invites } from "@rallix/db";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { InviteLink } from "../../../../components/InviteLink";
import { inClub, requirePermission } from "../../../../lib/context";

export const dynamic = "force-dynamic";

/** The link a club shares in its group chat. People read the club page first, then apply or join. */
export default async function Invite() {
  const ctx = await requirePermission("members");
  const [inv] = await inClub(ctx, (tx) => tx.select({ code: invites.code }).from(invites)
    .where(and(eq(invites.clubId, ctx.club.clubId), isNull(invites.revokedAt), or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())))).orderBy(desc(invites.createdAt)).limit(1));
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Invite players">
      <Panel title="Invite link"><InviteLink clubName={ctx.club.name} initialCode={inv?.code ?? null} /></Panel>
    </PageShell>
  );
}
