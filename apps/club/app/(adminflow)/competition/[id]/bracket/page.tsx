import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, PageShell } from "@rallix/ui";
import { RoundResults } from "../../../../../components/RoundResults";
import { inClub, requireRole } from "../../../../../lib/context";
import { getCompetition, listMatches } from "../../../../../lib/queries";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireRole("admin", "scorer");
  const data = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return null;
    return { c, ms: await listMatches(tx, ctx.club.clubId, { competitionId: id }) };
  });
  if (!data) notFound();
  const done = data.ms.filter((m) => m.status === "completed").length;
  return (
    <PageShell back={<BackButton href={`/competition/${id}/groups`} linkAs={Link} />} title={`${data.c.name} results`}>
      <p className="rx-muted" style={{ margin: 0 }}>{done} of {data.ms.length} matches played. Knockout rounds are not generated yet.</p>
      <RoundResults matches={data.ms} />
    </PageShell>
  );
}
