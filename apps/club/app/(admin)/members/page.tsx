import Link from "next/link";
import { EmptyState, PageShell, SectionTitle } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requirePermission } from "../../../lib/context";
import { listMembers } from "../../../lib/queries";
import { listPendingApplications } from "../../../lib/applications";
import { Applications } from "../../../components/Applications";
import { dayLabel } from "../../../lib/highlights";
import { MembersGrid } from "./MembersGrid";

export default async function Members() {
  const ctx = await requirePermission("members");
  const members = await inClub(ctx, (tx) => listMembers(tx, ctx.club.clubId));
  const waiting = await inClub(ctx, (tx) => listPendingApplications(tx, ctx.club.clubId));
  return (
    <PageShell flat header={<ClubHeader />} title={`Members · ${members.length}`} action={members.length ? <Link className="rx-btn rx-btn--small" href="/profile/invite" aria-label="Invite players">+ Invite</Link> : undefined}>
      {waiting.length ? (
        <>
          <SectionTitle title={`Waiting to join (${waiting.length})`} />
          <Applications items={waiting.map((w) => ({ id: w.id, name: w.name, level: w.level, message: w.message, ago: dayLabel(w.createdAt) }))} />
          <div style={{ height: 8 }} />
        </>
      ) : null}
      {members.length === 0 ? (
        <EmptyState title="No players yet" hint="Share your invite link and they will appear here." action={<Link className="rx-btn" href="/profile/invite">Get invite link</Link>} />
      ) : <MembersGrid members={members.map((m) => ({ id: m.id, name: m.name, rank: m.rank, rating: m.rating, photo: m.photo ?? null }))} />}
    </PageShell>
  );
}
