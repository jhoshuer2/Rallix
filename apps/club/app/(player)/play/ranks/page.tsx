import { PageShell } from "@rallix/ui";
import { ClubHeader } from "../../../../components/ClubHeader";
import { inClub, requireClub } from "../../../../lib/context";
import { globalLeaderboard, listMembers } from "../../../../lib/queries";
import { Ranks } from "./Ranks";

export default async function RanksPage() {
  const ctx = await requireClub();
  const d = await inClub(ctx, async (tx) => ({ club: await listMembers(tx, ctx.club.clubId), global: await globalLeaderboard(tx) }));
  return (
    <PageShell flat header={<ClubHeader />} title="Ranks">
      <Ranks clubName={ctx.club.name} meId={ctx.club.membershipId} meUserId={ctx.user.id}
        club={d.club.map((m) => ({ id: m.id, name: m.name, rank: m.rank, points: m.rating, photo: m.photo }))}
        global={d.global.map((g, i) => ({ id: g.user_id, name: g.name, rank: i + 1, points: Number(g.rating), photo: null }))} />
    </PageShell>
  );
}
