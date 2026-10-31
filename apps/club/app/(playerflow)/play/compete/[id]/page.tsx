import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, Bracket, BracketRound, MatchCard, MatchPair, PageHead, SectionHeader } from "@rallix/ui";
import { inClub, requireClub } from "../../../../../lib/context";
import { getCompetition, listMatches, listMembers } from "../../../../../lib/queries";
import { slotOf } from "../../../../../lib/view";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CompDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const data = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return null;
    return { c, ms: await listMatches(tx, ctx.club.clubId, { competitionId: id }), members: await listMembers(tx, ctx.club.clubId) };
  });
  if (!data) notFound();
  const rank = new Map(data.members.map((m) => [m.id, m.rank]));
  const mine = data.ms.filter((m) => m.p1?.id === me || m.p2?.id === me);
  const rounds = [...new Set(data.ms.map((m) => m.round))];
  return (
    <>
      <PageHead back={<BackButton href="/play/compete" linkAs={Link} />} title={data.c.name} />
      <SectionHeader title="My fixtures" />
      {mine.length === 0 ? <p className="rx-muted">You have no fixtures in this competition.</p> : mine.map((m) => {
        const opp = m.p1?.id === me ? m.p2 : m.p1;
        const won = m.winnerId === me;
        return <MatchCard key={m.id} title={m.round} when={m.confirmedAt ? m.confirmedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : m.scheduledAt ? m.scheduledAt.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }) : "TBC"}
          opponent={opp?.name ?? "TBD"} opponentPhoto={opp?.photo ?? undefined}
          result={m.status === "completed" ? { won, score: m.p1?.id === me ? `${m.gamesP1}–${m.gamesP2}` : `${m.gamesP2}–${m.gamesP1}` } : undefined}
          href={`/play/compete/${id}/match/${m.id}`} linkAs={Link} />;
      })}
      <SectionHeader title="All results" />
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
