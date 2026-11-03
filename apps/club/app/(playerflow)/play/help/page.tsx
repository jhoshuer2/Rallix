import Link from "next/link";
import { BackButton, PageShell } from "@rallix/ui";
import { HelpForm } from "../../../../components/HelpForm";
import { MyRequests } from "../../../../components/MyRequests";
import { inClub, requireClub } from "../../../../lib/context";
import { myRequests } from "../../../../lib/help-queries";

export const dynamic = "force-dynamic";

export default async function Help() {
  const ctx = await requireClub();
  const items = await inClub(ctx, (tx) => myRequests(tx));
  return (
    <PageShell back={<BackButton href="/play/me" linkAs={Link} />} title="Help">
      <p className="rx-muted" style={{ margin: "0 0 12px" }}>Something not working? Tell us and we’ll reply by email. For questions about the club itself, ask your club admin.</p>
      <HelpForm />
      <MyRequests items={items} />
    </PageShell>
  );
}
