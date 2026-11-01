import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, IconBadge, ListGroup, ListRow, PageShell } from "@rallix/ui";

const levels: Record<string, string> = { junior: "Junior", intermediate: "Intermediate", senior: "Senior", combined: "Combined" };

export default async function Selection({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const name = levels[level];
  if (!name) notFound();
  return (
    <PageShell back={<BackButton href="/competition/new" linkAs={Link} />} title={`${name} competition`}>
      <h2 className="rx-panel__title" style={{ margin: "0 0 4px" }}>How do you want to pick players?</h2>
      <ListGroup label="Player selection">
        <ListRow media={<IconBadge icon="grid" />} title="Automatic player selection" subtitle="Everyone at this level is included" href={`/competition/new/${level}/auto`} linkAs={Link} />
        <ListRow media={<IconBadge icon="user-add" />} title="Manual player selection" subtitle="Choose who plays" href={`/competition/new/${level}/auto?manual=1`} linkAs={Link} />
      </ListGroup>
    </PageShell>
  );
}
