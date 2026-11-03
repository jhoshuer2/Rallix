import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { HelpForm } from "../../../../components/HelpForm";
import { MyRequests } from "../../../../components/MyRequests";
import { inClub, requireRole } from "../../../../lib/context";
import { myRequests } from "../../../../lib/help-queries";

export const dynamic = "force-dynamic";

export default async function Help() {
  const ctx = await requireRole("admin");
  const items = await inClub(ctx, (tx) => myRequests(tx));
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Help">
      <p className="rx-muted" style={{ margin: "0 0 12px" }}>Something not working, or a question about Rallix? Tell us and we’ll reply by email.</p>
      <HelpForm />
      <MyRequests items={items} />
    </PageShell>
  );
}
