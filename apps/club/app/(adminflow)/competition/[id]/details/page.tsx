import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { PhotoUploader } from "../../../../../components/PhotoUploader";
import { inClub, requirePermission } from "../../../../../lib/context";
import { getCompetition } from "../../../../../lib/queries";
import { matches } from "@rallix/db";
import { and, eq, sql } from "drizzle-orm";
import { listSeasons } from "../../../../../lib/standings-queries";
import { DetailsForm } from "./DetailsForm";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Details({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requirePermission("competitions");
  const data = await inClub(ctx, async (tx) => ({ c: await getCompetition(tx, id), seasons: await listSeasons(tx, ctx.club.clubId), played: ((await tx.select({ n: sql<number>`count(*)::int` }).from(matches).where(and(eq(matches.competitionId, id), eq(matches.status, "completed"))))[0]?.n ?? 0) }));
  const c = data.c;
  if (!c) notFound();
  return (
    <PageShell back={<BackButton href={`/competition/${id}/groups`} linkAs={Link} />} title="Edit details">
      <Panel title="Cover picture"><PhotoUploader kind="competition-cover" competitionId={id} name={c.name} current={c.coverUrl} label="Competition cover" shape="cover" /></Panel>
      <DetailsForm id={id} draft={c.status === "draft"} initial={{ summary: c.summary ?? "", prize: c.prize ?? "", rules: c.rules ?? "", openRegistration: c.openRegistration, maxPlayers: c.maxPlayers ? String(c.maxPlayers) : "", closesOn: c.registrationClosesOn ?? "", pointsWin: String(c.pointsWin), pointsLoss: String(c.pointsLoss), seasonId: c.seasonId ?? "" }}
        seasons={data.seasons.map((x) => ({ value: x.id, label: x.name }))} matchRules={{ bestOf: c.bestOf, points: c.gamePoints, winBy: c.winBy === 1 ? 1 : 2, cap: c.pointCap }} rulesLocked={data.played > 0} league={c.format !== "knockout"} />
    </PageShell>
  );
}
