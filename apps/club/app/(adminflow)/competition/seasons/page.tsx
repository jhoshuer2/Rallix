import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { inClub, requirePermission } from "../../../../lib/context";
import { todayInClub } from "../../../../lib/highlights";
import { listSeasons, seasonStandings } from "../../../../lib/standings-queries";
import { SeasonManager } from "./SeasonManager";

export const dynamic = "force-dynamic";

/** Seasons group competitions; the season table adds up the points from all of them. */
export default async function Seasons() {
  const ctx = await requirePermission("competitions");
  const today = todayInClub();
  const data = await inClub(ctx, async (tx) => {
    const list = await listSeasons(tx, ctx.club.clubId);
    return Promise.all(list.map(async (s) => ({ ...s, leader: (await seasonStandings(tx, ctx.club.clubId, s.id))[0] ?? null })));
  });
  return (
    <PageShell back={<BackButton href="/competition" linkAs={Link} />} title="Seasons">
      <SeasonManager today={today} seasons={data.map((s) => ({ id: s.id, name: s.name, startsOn: s.startsOn, endsOn: s.endsOn, leader: s.leader ? `${s.leader.person.name} · ${s.leader.points} pts` : null }))} />
    </PageShell>
  );
}
