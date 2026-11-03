import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { competitionEntries, memberships, playerProfiles, users } from "@rallix/db";
import { inClub, requirePermission } from "../../../../../lib/context";
import { getCompetition } from "../../../../../lib/queries";
import { Shuffle } from "./Shuffle";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ShufflePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requirePermission("competitions");
  const data = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return null;
    const rows = await tx.select({ name: users.name, photo: playerProfiles.photoUrl }).from(competitionEntries)
      .innerJoin(memberships, eq(memberships.id, competitionEntries.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id)).where(and(eq(competitionEntries.competitionId, id))).limit(6);
    return rows;
  });
  if (!data) notFound();
  return <Shuffle id={id} players={data.map((p) => ({ name: p.name, photo: p.photo ?? null }))} />;
}
