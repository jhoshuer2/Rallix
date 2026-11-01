import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { invites } from "@rallix/db";
import { ListGroup, ListRow, PageShell, Panel, Photo } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { inClub, requireRole } from "../../../lib/context";
import { InviteLink } from "./InviteLink";
import { ContactForm } from "../../../components/ContactForm";
import { ownEmailOptOut, ownPhone } from "../../../lib/contact";
import { EmailPrefs } from "../../../components/EmailPrefs";

export default async function Profile() {
  const ctx = await requireRole("admin");
  const [inv] = await inClub(ctx, (tx) => tx.select({ code: invites.code }).from(invites)
    .where(and(eq(invites.clubId, ctx.club.clubId), isNull(invites.revokedAt), or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())))).orderBy(desc(invites.createdAt)).limit(1));
  return (
    <PageShell header={<ClubHeader />} title="Profile">
      <ListGroup><ListRow media={<Photo src={ctx.user.image} name={ctx.user.name} alt="" />} title={ctx.user.name} subtitle={`Club admin · ${ctx.club.name}`} /></ListGroup>
      <Panel title="Invite players"><InviteLink clubName={ctx.club.name} initialCode={inv?.code ?? null} /></Panel>
      <Panel title="Contact details"><ContactForm email={ctx.user.email} phone={await ownPhone(ctx.user.id)} /></Panel>
      <Panel title="Email"><EmailPrefs optedOut={await ownEmailOptOut(ctx.user.id)} /></Panel>
      <a className="rx-btn rx-btn--ghost rx-btn--block" style={{ marginTop: 16, boxSizing: "border-box" }} href="/sign-out">Sign out</a>
    </PageShell>
  );
}
