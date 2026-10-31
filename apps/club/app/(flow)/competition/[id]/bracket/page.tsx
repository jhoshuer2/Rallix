import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, Bracket, BracketRound, MatchPair, PageHead } from "@rallix/ui";
import { inClub, requireRole } from "../../../../../lib/context";
import { getCompetition, listMatches, listMembers } from "../../../../../lib/queries";
import { slotOf } from "../../../../../lib/view";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireRole("admin", "scorer");
  const data = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return null;
    return { c, ms: await listMatches(tx, ctx.club.clubId, { competitionId: id }), members: await listMembers(tx, ctx.club.clubId) };
  });
  if (!data) notFound();
  const rank = new Map(data.members.map((m) => [m.id, m.rank]));
  const rounds = [...new Set(data.ms.map((m) => m.round))];
  const done = data.ms.filter((m) => m.status === "completed").length;
  return (
    <>
      <PageHead back={<BackButton href={`/competition/${id}/groups`} linkAs={Link} />} title={`${data.c.name} results`} />
      <p className="rx-muted" style={{ marginTop: 0 }}>{done} of {data.ms.length} matches played. Knockout rounds are not generated yet.</p>
      <Bracket>
        {rounds.map((round) => (
          <BracketRound key={round} title={round}>
            {data.ms.filter((m) => m.round === round).map((m) => <MatchPair key={m.id} a={slotOf(m, 1, rank)} b={slotOf(m, 2, rank)} />)}
          </BracketRound>
        ))}
      </Bracket>
    </>
  );
}
