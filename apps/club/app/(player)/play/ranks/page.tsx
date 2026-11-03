import { PageShell } from "@rallix/ui";
import { ClubHeader } from "../../../../components/ClubHeader";
import { inClub, requireClub } from "../../../../lib/context";
import { globalLeaderboard, listMembers } from "../../../../lib/queries";
import { currentSeason, seasonStandings } from "../../../../lib/standings-queries";
import { todayInClub } from "../../../../lib/highlights";
import { Ranks } from "./Ranks";

export default async function RanksPage() {
  const ctx = await requireClub();
  const d = await inClub(ctx, async (tx) => {
    const season = await currentSeason(tx, ctx.club.clubId, todayInClub());
    const table = season ? await seasonStandings(tx, ctx.club.clubId, season.id) : [];
    return { club: await listMembers(tx, ctx.club.clubId), global: await globalLeaderboard(tx), season: season && table.length ? { name: season.name, rows: table } : null };
  });
  return (
    <PageShell flat header={<ClubHeader />} title="Ranks">
      <Ranks clubName={ctx.club.name} meId={ctx.club.membershipId} meUserId={ctx.user.id}
        club={d.club.map((m) => ({ id: m.id, name: m.name, rank: m.rank, points: m.rating, photo: m.photo }))}
        season={d.season ? { name: d.season.name, rows: d.season.rows.map((r) => ({ id: r.person.id, name: r.person.name, rank: r.rank, points: r.points, photo: r.person.photo })) } : null}
        global={d.global.map((g, i) => ({ id: g.user_id, name: g.name, rank: i + 1, points: Number(g.rating), photo: null }))} />
    </PageShell>
  );
}
