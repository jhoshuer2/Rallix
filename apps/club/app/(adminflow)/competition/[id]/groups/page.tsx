import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, EmptyState, PageShell } from "@rallix/ui";
import { RoundResults } from "../../../../../components/RoundResults";
import { canScore, inClub, requireRole } from "../../../../../lib/context";
import { getCompetition, listMatches } from "../../../../../lib/queries";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Groups({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireRole("admin", "scorer");
  const data = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return null;
    return { c, ms: await listMatches(tx, ctx.club.clubId, { competitionId: id }) };
  });
  if (!data) notFound();
  const mayScore = canScore(ctx.club);
  const open = (m: (typeof data.ms)[number]) => mayScore && m.status !== "completed" && !!m.p1 && !!m.p2;
  return (
    <PageShell back={<BackButton href="/competition" linkAs={Link} />} title={data.c.name}>
      {data.ms.length === 0 ? <EmptyState compact title="No matches yet" hint="Fixtures appear once the draw is made." /> : (
        <RoundResults matches={data.ms} hrefFor={(m) => (open(m) ? `/competition/${id}/score?match=${m.id}` : undefined)} actionFor={(m) => (open(m) ? "Score" : undefined)} />
      )}
      <Link className="rx-btn rx-btn--block" style={{ marginTop: 32 }} href={`/competition/${id}/bracket`}>Results</Link>
    </PageShell>
  );
}
