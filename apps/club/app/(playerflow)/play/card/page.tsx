import Link from "next/link";
import { BackButton, ListGroup, ListRow, PageShell, Panel, Photo } from "@rallix/ui";
import { standing, STANDING_LABEL } from "@rallix/stats";
import { MemberCard } from "../../../../components/MemberCard";
import { inClub, requireClub } from "../../../../lib/context";
import { issueCard } from "../../../../lib/card";
import { todayInClub } from "../../../../lib/highlights";
import { listDues, listMembers } from "../../../../lib/queries";

export const dynamic = "force-dynamic";

/** The member card: who you are in this club, your standing, and a QR the door can scan. */
export default async function Card() {
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const d = await inClub(ctx, async (tx) => ({ dues: await listDues(tx, ctx.club.clubId, me), members: await listMembers(tx, ctx.club.clubId) }));
  const mine = d.members.find((m) => m.id === me);
  const s = standing(d.dues.map((x) => ({ status: x.status, dueDate: x.dueDate })), todayInClub());
  return (
    <PageShell back={<BackButton href="/play/me" linkAs={Link} />} title="Member card">
      <ListGroup label="Member">
        <ListRow media={<Photo src={mine?.photo ?? ctx.user.image} name={ctx.user.name} alt="" />} title={ctx.user.name} subtitle={`${ctx.club.name} · ${STANDING_LABEL[s]}`} />
      </ListGroup>
      <Panel><MemberCard initialToken={issueCard(ctx.club.clubId, me)} /></Panel>
    </PageShell>
  );
}
