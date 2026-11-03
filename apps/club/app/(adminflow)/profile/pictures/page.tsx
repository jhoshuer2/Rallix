import Link from "next/link";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { PhotoUploader } from "../../../../components/PhotoUploader";
import { requirePermission } from "../../../../lib/context";

export const dynamic = "force-dynamic";

export default async function ClubPictures() {
  const ctx = await requirePermission("members");
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Club pictures">
      <Panel title="Club pictures">
        <div style={{ display: "grid", gap: 20 }}>
          <PhotoUploader kind="club-logo" name={ctx.club.name} current={ctx.club.logoUrl} label="Club logo" shape="club" />
          <PhotoUploader kind="club-cover" name={ctx.club.name} current={ctx.club.coverUrl} label="Club cover" shape="cover" />
        </div>
      </Panel>
    </PageShell>
  );
}
