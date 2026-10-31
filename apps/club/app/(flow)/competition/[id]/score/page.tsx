import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canScore, inClub, requireClub } from "../../../../../lib/context";
import { listMatches, listMembers } from "../../../../../lib/queries";
import { ScoreSheet } from "./ScoreSheet";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Score({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ match?: string }> }) {
  const { id } = await params;
  const { match } = await searchParams;
  if (!match || !uuid.test(match)) notFound();
  const ctx = await requireClub();
  if (!canScore(ctx.club)) redirect("/play");
  const { ms, members } = await inClub(ctx, async (tx) => ({ ms: await listMatches(tx, ctx.club.clubId, { matchId: match }), members: await listMembers(tx, ctx.club.clubId) }));
  const m = ms[0];
  const rank = new Map(members.map((x) => [x.id, x.rank]));
  if (!m || !m.p1 || !m.p2) notFound();
  if (m.status === "completed") return <p>This match has already been recorded. <Link className="rx-btn" href={`/competition/${id}/groups`}>Back</Link></p>;
  return <ScoreSheet competitionId={id} matchId={m.id} bestOf={m.bestOf} p1={{ ...m.p1, rank: rank.get(m.p1.id) ?? 0 }} p2={{ ...m.p2, rank: rank.get(m.p2.id) ?? 0 }} />;
}
