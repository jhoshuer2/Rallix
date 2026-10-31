import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, FormatCard, PageHead } from "@rallix/ui";

const levels: Record<string, string> = { junior: "Junior", intermediate: "Intermediate", senior: "Senior", combined: "Combined" };

export default async function Selection({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const name = levels[level];
  if (!name) notFound();
  return (
    <>
      <PageHead back={<BackButton href="/competition/new" linkAs={Link} />} title={`${name} level competition`} />
      <FormatCard linkAs={Link} title="Automatic player selection" href={`/competition/new/${level}/auto`} />
      <FormatCard linkAs={Link} title="Manual player selection" href={`/competition/new/${level}/auto?manual=1`} />
    </>
  );
}
