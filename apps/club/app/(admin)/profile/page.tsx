import Link from "next/link";
import { IconBadge, ListGroup, ListRow, PageShell, Photo } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { can, requireRole } from "../../../lib/context";

/** The Club tab: a short menu. Each row opens one screen, and an admin only sees the rows for what they look after. */
export default async function Club() {
  const ctx = await requireRole("admin");
  const c = ctx.club;
  return (
    <PageShell header={<ClubHeader />} title="Club">
      <ListGroup label="You"><ListRow media={<Photo src={ctx.user.image} name={ctx.user.name} alt="" />} title={ctx.user.name} subtitle={c.isOwner ? `Owner · ${c.name}` : `Admin · ${c.name}`} href="/profile/me" linkAs={Link} /></ListGroup>
      <ListGroup label="Your club">
        {can(c, "members") ? <ListRow media={<IconBadge icon="edit" />} title="Club page" subtitle="What people read before they join" href="/profile/club-page" linkAs={Link} /> : null}
        {can(c, "members") ? <ListRow media={<IconBadge icon="user-add" />} title="Invite players" subtitle="Share your club link" href="/profile/invite" linkAs={Link} /> : null}
        {can(c, "members") ? <ListRow media={<IconBadge icon="image" />} title="Club pictures" subtitle="Logo and cover" href="/profile/pictures" linkAs={Link} /> : null}
        {can(c, "facilities") ? <ListRow media={<IconBadge icon="pin" />} title="Court and check-in" subtitle="Where players check in" href="/profile/court" linkAs={Link} /> : null}
        {can(c, "facilities") ? <ListRow media={<IconBadge icon="grid" />} title="Facilities" subtitle="Tables, bats, balls and upkeep" href="/profile/facilities" linkAs={Link} /> : null}
        {can(c, "facilities") ? <ListRow media={<IconBadge icon="calendar" />} title="Schedule" subtitle="Playing times, events and closures" href="/profile/schedule" linkAs={Link} /> : null}
        <ListRow media={<IconBadge icon="members" />} title="Admin team" subtitle={c.isOwner ? "Choose what each admin looks after" : "Who runs the club"} href="/profile/team" linkAs={Link} />
      </ListGroup>
      <ListGroup label="Support"><ListRow media={<IconBadge icon="chat" />} title="Help" subtitle="Ask Rallix support" href="/profile/help" linkAs={Link} /></ListGroup>
      <a className="rx-btn rx-btn--ghost rx-btn--block" style={{ marginTop: 24, boxSizing: "border-box" }} href="/sign-out">Sign out</a>
    </PageShell>
  );
}
