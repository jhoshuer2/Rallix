import Link from "next/link";
import { BackButton, FormatCard, PageHead } from "@rallix/ui";
import { requireRole } from "../../../../lib/context";

export default async function SelectLevel() {
  await requireRole("admin");
  return (
    <>
      <PageHead back={<BackButton href="/competition" linkAs={Link} />} title="Select competition format" />
      <FormatCard linkAs={Link} title="Junior" href="/competition/new/junior" />
      <FormatCard linkAs={Link} title="Intermediate" href="/competition/new/intermediate" />
      <FormatCard linkAs={Link} title="Senior" href="/competition/new/senior" />
      <FormatCard linkAs={Link} title="Combine levels" href="/competition/new/combined" />
    </>
  );
}
