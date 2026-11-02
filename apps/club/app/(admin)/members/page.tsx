import Link from "next/link";
import { PageShell } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requireRole } from "../../../lib/context";
import { listMembers } from "../../../lib/queries";
import { MembersGrid } from "./MembersGrid";

export default async function Members() {
  const ctx = await requireRole("admin");
  const members = await inClub(ctx, (tx) => listMembers(tx, ctx.club.clubId));
  return (
    <PageShell flat header={<ClubHeader />} title={`Members · ${members.length}`} action={members.length ? <Link className="rx-btn rx-btn--small" href="/profile" aria-label="Invite players">+ Invite</Link> : undefined}>
      {members.length === 0 ? (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <p className="rx-muted" style={{ margin: "0 0 16px" }}>No players yet. Share your invite link and they will appear here.</p>
          <Link className="rx-btn" href="/profile">Get invite link</Link>
        </div>
      ) : <MembersGrid members={members.map((m) => ({ id: m.id, name: m.name, rank: m.rank, rating: m.rating, photo: m.photo ?? null }))} />}
    </PageShell>
  );
}
