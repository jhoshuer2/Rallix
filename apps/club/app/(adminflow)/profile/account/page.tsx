import Link from "next/link";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { AccountForm } from "../../../../components/AccountForm";
import { accountStatus } from "../../../../lib/account-queries";
import { requireClub } from "../../../../lib/context";

export const dynamic = "force-dynamic";

export default async function Account() {
  const ctx = await requireClub();
  const s = await accountStatus(ctx.user.id);
  return (
    <PageShell back={<BackButton href="/profile" linkAs={Link} />} title="Username and password">
      <Panel><AccountForm email={ctx.user.email} username={s.username} hasPassword={s.hasPassword} /></Panel>
    </PageShell>
  );
}
