import Link from "next/link";
import { BackButton, ListGroup, ListRow, PageShell, Photo } from "@rallix/ui";
import { mergeActivity, type Activity } from "@rallix/stats";
import { inClub, requireClub } from "../../../lib/context";
import { byRecent, dayLabel, isDone } from "../../../lib/highlights";
import { listMatches, listMembers, naira, recentPayments } from "../../../lib/queries";

export const dynamic = "force-dynamic";

/** Derived from real records only (no unread count): results, new members and, for admins, payments. */
export default async function ActivityPage() {
  const ctx = await requireClub();
  const admin = ctx.club.roles.includes("admin");
  const d = await inClub(ctx, async (tx) => ({
    matches: await listMatches(tx, ctx.club.clubId),
    members: await listMembers(tx, ctx.club.clubId),
    pays: admin ? await recentPayments(tx, ctx.club.clubId, 15) : [],
  }));
  const feed = mergeActivity([
    d.matches.filter(isDone).sort(byRecent).slice(0, 15).map<Activity>((m) => ({ id: `m${m.id}`, kind: "result", at: m.confirmedAt ?? new Date(0), title: `${m.p1!.name} ${m.gamesP1}-${m.gamesP2} ${m.p2!.name}`, detail: m.competitionName, href: admin ? `/competition/${m.competitionId}/groups` : `/play/compete/${m.competitionId}` })),
    d.members.slice().sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime()).slice(0, 10).map<Activity>((x) => ({ id: `j${x.id}`, kind: "member", at: x.joinedAt, title: `${x.name} joined the club`, href: admin ? `/members/${x.id}` : undefined })),
    d.pays.map<Activity>((p) => ({ id: `p${p.id}`, kind: "payment", at: p.paidAt ?? new Date(0), title: `${p.name} paid ${naira(p.amountKobo)}` })),
  ], 25);
  
  return (
    <PageShell back={<BackButton href={admin ? "/" : "/play"} linkAs={Link} />} title="Activity">
      {feed.length ? (
        <ListGroup label="Recent activity">
          {feed.map((a) => <ListRow key={a.id} media={<Photo name={a.title} alt="" />} title={a.title} subtitle={[a.detail, dayLabel(a.at)].filter(Boolean).join(" · ")} href={a.href} />)}
        </ListGroup>
      ) : <p className="rx-muted" style={{ marginTop: 24 }}>Nothing yet. Results, new members and payments show up here.</p>}
    </PageShell>
  );
}
