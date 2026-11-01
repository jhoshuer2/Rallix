import Link from "next/link";
import { Count } from "@rallix/ui";
import { inClub, requireRole } from "../../../lib/context";
import { listMembers } from "../../../lib/queries";
import { MembersGrid } from "./MembersGrid";

export default async function Members() {
  const ctx = await requireRole("admin");
  const members = await inClub(ctx, (tx) => listMembers(tx, ctx.club.clubId));
  return (
    <>
      <div className="rx-pagehead__row" style={{ alignItems: "center" }}>
        <h1 className="rx-title">Members <Count>{members.length}</Count></h1>
        <Link className="rx-btn rx-btn--small" href="/profile" aria-label="Invite players">+ Invite</Link>
      </div>
      {members.length === 0 ? (
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <p className="rx-muted" style={{ margin: "0 0 16px" }}>No players yet. Share your invite link and they will appear here.</p>
          <Link className="rx-btn" href="/profile">Get invite link</Link>
        </div>
      ) : <MembersGrid members={members.map((m) => ({ id: m.id, name: m.name, rank: m.rank, rating: m.rating, photo: m.photo ?? null }))} />}
    </>
  );
}
