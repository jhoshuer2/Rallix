import Link from "next/link";
import { eq } from "drizzle-orm";
import { clubPages } from "@rallix/db";
import { BackButton, PageShell } from "@rallix/ui";
import { inClub, requireRole } from "../../../../lib/context";
import { ClubPageForm } from "./ClubPageForm";

export const dynamic = "force-dynamic";

/** Admins write what people read before they join. Fees are not typed here: they come from the fee plans. */
export default async function ClubPageEditor() {
  const ctx = await requireRole("admin");
  const [p] = await inClub(ctx, (tx) => tx.select().from(clubPages).where(eq(clubPages.clubId, ctx.club.clubId)));
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Club page">
      <ClubPageForm slug={ctx.club.slug} initial={{
        about: p?.about ?? "", schedule: p?.schedule ?? "", dressCode: p?.dressCode ?? "", equipment: p?.equipment ?? "", rules: p?.rules ?? "", contact: p?.contact ?? "",
        joinMode: p?.joinMode === "open" ? "open" : "review", published: !!p?.published,
      }} />
    </PageShell>
  );
}
