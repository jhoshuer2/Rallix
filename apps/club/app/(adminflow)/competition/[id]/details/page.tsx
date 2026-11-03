import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { PhotoUploader } from "../../../../../components/PhotoUploader";
import { inClub, requirePermission } from "../../../../../lib/context";
import { getCompetition } from "../../../../../lib/queries";
import { DetailsForm } from "./DetailsForm";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Details({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requirePermission("competitions");
  const c = await inClub(ctx, (tx) => getCompetition(tx, id));
  if (!c) notFound();
  return (
    <PageShell back={<BackButton href={`/competition/${id}/groups`} linkAs={Link} />} title="Edit details">
      <Panel title="Cover picture"><PhotoUploader kind="competition-cover" competitionId={id} name={c.name} current={c.coverUrl} label="Competition cover" shape="cover" /></Panel>
      <DetailsForm id={id} draft={c.status === "draft"} initial={{ summary: c.summary ?? "", prize: c.prize ?? "", rules: c.rules ?? "", openRegistration: c.openRegistration, maxPlayers: c.maxPlayers ? String(c.maxPlayers) : "", closesOn: c.registrationClosesOn ?? "" }} />
    </PageShell>
  );
}
