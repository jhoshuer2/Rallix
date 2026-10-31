import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, MatchPair, PageHead, SectionHeader } from "@rallix/ui";
import { canScore, inClub, requireRole } from "../../../../../lib/context";
import { getCompetition, listMatches, listMembers } from "../../../../../lib/queries";
import { slotOf } from "../../../../../lib/view";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Groups({ params }: { params: Promise<{ id: string }> }) {
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
  const mayScore = canScore(ctx.club);
  return (
    <>
      <PageHead back={<BackButton href="/competition" linkAs={Link} />} title={data.c.name} />
      {data.ms.length === 0 ? <p className="rx-muted">No matches yet.</p> : null}
      {rounds.map((round) => (
        <section key={round}>
          <SectionHeader title={round} />
          {data.ms.filter((m) => m.round === round).map((m) => {
            const pair = <MatchPair a={slotOf(m, 1, rank)} b={slotOf(m, 2, rank)} />;
            const open = mayScore && m.status !== "completed" && m.p1 && m.p2;
            return open
              ? <Link key={m.id} href={`/competition/${id}/score?match=${m.id}`} style={{ color: "inherit", textDecoration: "none", display: "block" }} aria-label={`Score ${m.p1!.name} versus ${m.p2!.name}`}>{pair}</Link>
              : <div key={m.id}>{pair}</div>;
          })}
        </section>
      ))}
      <Link className="rx-btn rx-btn--block" href={`/competition/${id}/bracket`}>Results <span className="rx-btn__ball" aria-hidden="true" /></Link>
    </>
  );
}
