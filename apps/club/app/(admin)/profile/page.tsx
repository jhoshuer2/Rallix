import { Avatar, Card, SectionHeader } from "@rallix/ui";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { invites } from "@rallix/db";
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
    <>
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Profile</h1>
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar src={ctx.user.image ?? undefined} name={ctx.user.name} large />
          <div><strong>{ctx.user.name}</strong><br /><span>Club admin · {ctx.club.name}</span></div>
        </div>
      </Card>
      <SectionHeader title="Contact details" />
      <ContactForm email={ctx.user.email} phone={await ownPhone(ctx.user.id)} />
      <SectionHeader title="Email" />
      <EmailPrefs optedOut={await ownEmailOptOut(ctx.user.id)} />
      <SectionHeader title="Invite players" />
      <InviteLink clubName={ctx.club.name} initialCode={inv?.code ?? null} />
      <SectionHeader title="Account" />
      <a className="rx-btn rx-btn--ghost rx-btn--block" href="/sign-out">Sign out</a>
    </>
  );
}
