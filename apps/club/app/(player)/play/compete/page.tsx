import { inClub, requireClub } from "../../../../lib/context";
import { listCompetitions } from "../../../../lib/queries";
import { CompeteList } from "./CompeteList";

export default async function Compete() {
  const ctx = await requireClub();
  const comps = await inClub(ctx, (tx) => listCompetitions(tx, ctx.club.clubId, ctx.club.membershipId));
  const tab = (s: string) => (s === "active" ? "Active" : s === "draft" ? "Upcoming" : "Past");
  return (
    <>
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Compete</h1>
      <CompeteList rows={comps.map((c) => ({ id: c.id, name: c.name, level: c.level, tab: tab(c.status) as "Active" | "Upcoming" | "Past", dates: `${c.startsOn ?? ""} – ${c.endsOn ?? ""}` }))} />
    </>
  );
}
