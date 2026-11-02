import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, EmptyState, PageShell, Pill, SectionTitle } from "@rallix/ui";
import { spotsLabel } from "@rallix/stats";
import { Entrants } from "../../../../../components/Entrants";
import { RoundResults } from "../../../../../components/RoundResults";
import { competitionEntries } from "@rallix/db";
import { eq } from "drizzle-orm";
import { canScore, inClub, isAdmin, requireRole } from "../../../../../lib/context";
import { getCompetition, listMatches, listMembers } from "../../../../../lib/queries";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Groups({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireRole("admin", "scorer");
  const data = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return null;
    const draft = c.status === "draft";
    const entrantIds = draft ? (await tx.select({ m: competitionEntries.membershipId }).from(competitionEntries).where(eq(competitionEntries.competitionId, id))).map((e) => e.m) : [];
    const roster = draft ? await listMembers(tx, ctx.club.clubId) : [];
    const pick = (m: (typeof roster)[number]) => ({ id: m.id, name: m.name, photo: m.photo });
    return { c, ms: await listMatches(tx, ctx.club.clubId, { competitionId: id }), entrants: roster.filter((m) => entrantIds.includes(m.id)).map(pick), others: roster.filter((m) => !entrantIds.includes(m.id)).map(pick) };
  });
  if (!data) notFound();
  const mayScore = canScore(ctx.club);
  const draft = data.c.status === "draft";
  const admin = isAdmin(ctx.club);
  const open = (m: (typeof data.ms)[number]) => mayScore && m.status !== "completed" && !!m.p1 && !!m.p2;
  return (
    <PageShell back={<BackButton href="/competition" linkAs={Link} />} title={data.c.name}>
      {draft ? (
        <>
          <p style={{ margin: "0 0 12px" }}><Pill tone={data.c.openRegistration ? "success" : "neutral"}>{data.c.openRegistration ? "Sign-up open" : "Sign-up closed"}</Pill> <span className="rx-muted">{spotsLabel(data.entrants.length, data.c.maxPlayers)}</span></p>
          {admin ? <Entrants id={id} entrants={data.entrants} others={data.others} max={data.c.maxPlayers} /> : null}
        </>
      ) : data.ms.length === 0 ? <EmptyState compact title="No matches yet" hint="Fixtures appear once the draw is made." /> : (
        <RoundResults matches={data.ms} hrefFor={(m) => (open(m) ? `/competition/${id}/score?match=${m.id}` : undefined)} actionFor={(m) => (open(m) ? "Score" : undefined)} />
      )}
      {!draft ? <Link className="rx-btn rx-btn--block" style={{ marginTop: 32 }} href={`/competition/${id}/bracket`}>Results</Link> : null}
      {admin ? <Link className="rx-btn rx-btn--ghost rx-btn--block" style={{ marginTop: 12, boxSizing: "border-box" }} href={`/competition/${id}/details`}>Edit details</Link> : null}
    </PageShell>
  );
}
