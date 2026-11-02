import { PageShell } from "@rallix/ui";
import { ClubHeader } from "../../../../components/ClubHeader";
import { inClub, requireClub } from "../../../../lib/context";
import { listCompetitionsForPlayer } from "../../../../lib/queries";
import { spotsLabel } from "@rallix/stats";
import { CompeteList } from "./CompeteList";

const short = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "");

export default async function Compete() {
  const ctx = await requireClub();
  const comps = await inClub(ctx, (tx) => listCompetitionsForPlayer(tx, ctx.club.clubId, ctx.club.membershipId));
  const tab = (s: string) => (s === "active" ? "Active" : s === "draft" ? "Upcoming" : "Past");
  return (
    <PageShell flat header={<ClubHeader />} title="Compete">
      <CompeteList rows={comps.map((c) => ({ id: c.id, name: c.name, level: c.level, tab: tab(c.status) as "Active" | "Upcoming" | "Past", dates: c.startsOn && c.endsOn ? `${short(c.startsOn)} – ${short(c.endsOn)}` : c.startsOn ? `From ${short(c.startsOn)}` : "Dates to be set", cover: c.coverUrl, registered: c.registered, open: c.status === "draft", spots: c.status === "draft" ? spotsLabel(c.entries, c.maxPlayers) : null }))} />
    </PageShell>
  );
}
