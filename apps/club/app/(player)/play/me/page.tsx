import Link from "next/link";
import { Avatar, Card, Chip, ClubRow, SectionHeader } from "@rallix/ui";
import { inClub, requireClub } from "../../../../lib/context";
import { ageOf, listMembers } from "../../../../lib/queries";
import { ContactForm } from "../../../../components/ContactForm";
import { ownPhone } from "../../../../lib/contact";

export default async function Me() {
  const ctx = await requireClub();
  const mine = (await inClub(ctx, (tx) => listMembers(tx, ctx.club.clubId))).find((m) => m.id === ctx.club.membershipId);
  const age = mine ? ageOf(mine.dob) : null;
  return (
    <>
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Me</h1>
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar src={mine?.photo ?? ctx.user.image ?? undefined} name={ctx.user.name} large />
          <div><strong>{ctx.user.name}</strong><br /><span>{mine?.country ?? "NGR"}{age ? ` · ${age} yrs` : ""}{mine?.heightCm ? ` · ${mine.heightCm} cm` : ""}</span><br />{mine ? <Chip tone="warn">{mine.level}</Chip> : null}</div>
        </div>
      </Card>
      <SectionHeader title="Contact details" />
      <ContactForm email={ctx.user.email} phone={await ownPhone(ctx.user.id)} />
      <SectionHeader title="Payments" />
      <Link className="rx-btn rx-btn--ghost rx-btn--block" href="/play/me/payments">Dues, receipts and history</Link>
      <SectionHeader title="My clubs" />
      {ctx.clubs.map((c) => <ClubRow key={c.clubId} name={c.name} logo={c.logoUrl ?? undefined} role={c.roles.includes("admin") ? "Admin" : "Player"} href={`/switch/${c.clubId}`} current={c.clubId === ctx.club.clubId} />)}
      <p className="rx-muted" style={{ fontSize: 13 }}>Your stats and payments are kept separately for each club.</p>
      <a className="rx-btn rx-btn--ghost rx-btn--block" href="/sign-out">Sign out</a>
    </>
  );
}
