import Link from "next/link";
import { IconBadge, ListGroup, ListRow, PageShell, Panel, Photo, Pill } from "@rallix/ui";
import { ClubHeader } from "../../../../components/ClubHeader";
import { inClub, requireClub } from "../../../../lib/context";
import { ageOf, listMembers } from "../../../../lib/queries";
import { ContactForm } from "../../../../components/ContactForm";
import { ownEmailOptOut, ownPhone } from "../../../../lib/contact";
import { EmailPrefs } from "../../../../components/EmailPrefs";
import { PhotoUploader } from "../../../../components/PhotoUploader";
import { ArrivalSettings } from "../../../../components/ArrivalSettings";
import { getArrivalSettings } from "../../../../lib/arrival-queries";

export default async function Me() {
  const ctx = await requireClub();
  const mine = (await inClub(ctx, (tx) => listMembers(tx, ctx.club.clubId))).find((m) => m.id === ctx.club.membershipId);
  const age = mine ? ageOf(mine.dob) : null;
  const facts = [mine?.country ?? "NGR", age ? `${age} yrs` : null, mine?.heightCm ? `${mine.heightCm} cm` : null].filter(Boolean).join(" · ");
  return (
    <PageShell header={<ClubHeader />} title="Me">
      <ListGroup>
        <ListRow media={<Photo src={mine?.photo ?? ctx.user.image} name={ctx.user.name} alt="" />} title={ctx.user.name} subtitle={facts} trailing={mine ? <Pill tone="warning">{mine.level}</Pill> : undefined} />
      </ListGroup>
      <Panel title="Your picture"><PhotoUploader kind="me" name={ctx.user.name} current={mine?.photo ?? null} label="Profile picture" shape="person" /></Panel>
      <ListGroup label="Membership">
        <ListRow media={<IconBadge icon="card" />} title="Member card" subtitle="Show it at the door" href="/play/card" linkAs={Link} />
        <ListRow media={<IconBadge icon="settings" />} title="Password sign-in" href="/play/me/account" linkAs={Link} />
      </ListGroup>
      <ListGroup label="Support"><ListRow media={<IconBadge icon="chat" />} title="Help" subtitle="Ask Rallix support" href="/play/help" linkAs={Link} /></ListGroup>
      <ListGroup label="Payments">
        <ListRow media={<IconBadge icon="wallet" />} title="Payments" subtitle="Dues, receipts and history" href="/play/me/payments" linkAs={Link} />
      </ListGroup>
      <Panel title="My clubs">
        <ListGroup bare label="My clubs">
          {ctx.clubs.map((c) => <ListRow key={c.clubId} media={<Photo src={c.logoUrl} name={c.name} kind="club" alt="" />} title={c.name} subtitle={c.roles.includes("admin") ? "Admin" : "Player"} href={`/switch/${c.clubId}`} current={c.clubId === ctx.club.clubId} trailing={c.clubId === ctx.club.clubId ? <Pill tone="success">Current</Pill> : undefined} />)}
        </ListGroup>
        <p className="rx-muted" style={{ fontSize: 13, margin: "12px 0 0" }}>Your stats and payments are kept separately for each club.</p>
      </Panel>
      <Panel title="At the court"><ArrivalSettings initial={await inClub(ctx, (tx) => getArrivalSettings(tx, ctx.club.membershipId))} vapidKey={process.env.VAPID_PUBLIC_KEY ?? null} /></Panel>
      <Panel title="Contact details"><ContactForm email={ctx.user.email} phone={await ownPhone(ctx.user.id)} /></Panel>
      <Panel title="Email"><EmailPrefs optedOut={await ownEmailOptOut(ctx.user.id)} /></Panel>
      <a className="rx-btn rx-btn--ghost rx-btn--block" style={{ marginTop: 16, boxSizing: "border-box" }} href="/sign-out">Sign out</a>
    </PageShell>
  );
}
