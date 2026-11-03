import Link from "next/link";
import { ListGroup, ListRow, PageShell } from "@rallix/ui";
import { ClubHeader } from "../../../../components/ClubHeader";
import { inClub, requireClub } from "../../../../lib/context";
import { listCompetitionsForPlayer } from "../../../../lib/queries";
import { listMyChallenges, needsMe } from "../../../../lib/friendly-queries";
import { spotsLabel } from "@rallix/stats";
import { CompeteList } from "./CompeteList";

const short = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "");

export default async function Compete() {
  const ctx = await requireClub();
  const { comps, friendlies } = await inClub(ctx, async (tx) => ({ comps: await listCompetitionsForPlayer(tx, ctx.club.clubId, ctx.club.membershipId), friendlies: await listMyChallenges(tx, ctx.club.clubId, ctx.club.membershipId) }));
  const waiting = needsMe(friendlies, ctx.club.membershipId).length;
  const tab = (s: string) => (s === "active" ? "Active" : s === "draft" ? "Upcoming" : "Past");
  return (
    <PageShell flat header={<ClubHeader />} title="Compete">
      <ListGroup label="Friendlies and calendar"><ListRow title="Calendar" subtitle="Playing times, events and closures" href="/play/calendar" linkAs={Link} /><ListRow title="Friendlies" subtitle={waiting ? `${waiting} need${waiting === 1 ? "s" : ""} you` : friendlies.length ? "Your matches with other members" : "Challenge another member"} href="/play/friendlies" linkAs={Link} /></ListGroup>
      <div style={{ height: 16 }} />
      <CompeteList rows={comps.map((c) => ({ id: c.id, name: c.name, level: c.level, tab: tab(c.status) as "Active" | "Upcoming" | "Past", dates: c.startsOn && c.endsOn ? `${short(c.startsOn)} – ${short(c.endsOn)}` : c.startsOn ? `From ${short(c.startsOn)}` : "Dates to be set", cover: c.coverUrl, registered: c.registered, open: c.status === "draft", spots: c.status === "draft" ? spotsLabel(c.entries, c.maxPlayers) : null }))} />
    </PageShell>
  );
}
