import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, Panel, PageShell } from "@rallix/ui";
import { ChallengeForm } from "../../../../../components/ChallengeForm";
import { inClub, requireClub } from "../../../../../lib/context";
import { listMembers } from "../../../../../lib/queries";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewChallenge({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  if (!to || !uuid.test(to)) notFound();
  const ctx = await requireClub();
  if (to === ctx.club.membershipId) notFound();
  const members = await inClub(ctx, (tx) => listMembers(tx, ctx.club.clubId));
  const other = members.find((m) => m.id === to);
  if (!other) notFound();
  return (
    <PageShell back={<BackButton href="/play/ranks" linkAs={Link} />} title={`Challenge ${other.name.split(/\s+/)[0]}`}>
      <Panel><ChallengeForm opponentId={other.id} opponentName={other.name} /></Panel>
    </PageShell>
  );
}
