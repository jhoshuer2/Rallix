import Link from "next/link";
import { BackButton, IconBadge, ListGroup, ListRow, PageShell } from "@rallix/ui";
import { requireRole } from "../../../../lib/context";

export default async function SelectLevel() {
  await requireRole("admin");
  return (
    <PageShell back={<BackButton href="/competition" linkAs={Link} />} title="New competition">
      <h2 className="rx-panel__title" style={{ margin: "0 0 4px" }}>Select the level</h2>
      <ListGroup label="Competition level">
        <ListRow media={<IconBadge icon="trophy" />} title="Junior" href="/competition/new/junior" linkAs={Link} />
        <ListRow media={<IconBadge icon="trophy" />} title="Intermediate" href="/competition/new/intermediate" linkAs={Link} />
        <ListRow media={<IconBadge icon="trophy" />} title="Senior" href="/competition/new/senior" linkAs={Link} />
        <ListRow media={<IconBadge icon="members" />} title="Combine levels" href="/competition/new/combined" linkAs={Link} />
      </ListGroup>
    </PageShell>
  );
}
