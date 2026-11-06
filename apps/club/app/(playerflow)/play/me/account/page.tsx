import Link from "next/link";
import { BackButton, PageShell, Panel } from "@rallix/ui";
import { BirthdayForm } from "../../../../../components/BirthdayForm";
import { myBirthday } from "../../../../../lib/birthday-queries";
import { inClub } from "../../../../../lib/context";
import { AccountForm } from "../../../../../components/AccountForm";
import { accountStatus } from "../../../../../lib/account-queries";
import { requireClub } from "../../../../../lib/context";

export const dynamic = "force-dynamic";

export default async function Account() {
  const ctx = await requireClub();
  const s = await accountStatus(ctx.user.id);
  const b = await inClub(ctx, (tx) => myBirthday(tx, ctx.club.membershipId));
  return (
    <PageShell back={<BackButton href="/play/me" linkAs={Link} />} title="Your account">
      <Panel title="Sign in"><AccountForm email={ctx.user.email} username={s.username} hasPassword={s.hasPassword} /></Panel>
      <Panel title="Birthday"><BirthdayForm month={b.month} day={b.day} show={b.show} /></Panel>
    </PageShell>
  );
}
