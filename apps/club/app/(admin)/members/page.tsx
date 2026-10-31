import Link from "next/link";
import { Count, IconButton, RankCard, RankGrid } from "@rallix/ui";
import { inClub, requireRole } from "../../../lib/context";
import { listMembers } from "../../../lib/queries";

export default async function Members() {
  const ctx = await requireRole("admin");
  const members = await inClub(ctx, (tx) => listMembers(tx, ctx.club.clubId));
  return (
    <>
      <div className="rx-pagehead__row" style={{ alignItems: "center", marginBottom: 16 }}>
        <h1 className="rx-title">Members <Count>{members.length}</Count></h1>
        <span style={{ display: "flex", gap: 8 }}>
          <Link className="rx-iconbtn" href="/profile" aria-label="Invite players">+</Link>
          <IconButton icon="search" label="Search members" />
        </span>
      </div>
      {members.length === 0 ? <p className="rx-muted">No players yet. Share your invite link from the Profile tab.</p> : (
        <RankGrid>
          {members.map((p) => <RankCard key={p.id} rank={p.rank} name={p.name} points={p.rating} photo={p.photo ?? undefined} href={`/members/${p.id}`} linkAs={Link} />)}
        </RankGrid>
      )}
    </>
  );
}
