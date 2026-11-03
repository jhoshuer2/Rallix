import Link from "next/link";
import { invites } from "@rallix/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { Carousel, Checklist, ClubBanner, EmptyState, IconBadge, ListGroup, ListRow, MediaCard, MetricCard, MetricGrid, PageShell, SectionTitle } from "@rallix/ui";
import { groupRegistrations, mergeActivity, setupProgress, type Activity } from "@rallix/stats";
import { ClubHeader } from "../../components/ClubHeader";
import { can, inClub, requireRole } from "../../lib/context";
import { dayLabel, isDone, byRecent } from "../../lib/highlights";
import { payoutsEnabled } from "../../lib/payment-queries";
import { getVenue } from "../../lib/arrival-queries";
import { hasClubPageContent, pendingApplicationCount } from "../../lib/applications";
import { entryCounts, listCompetitions, listDues, listMatches, listMembers, listPlans, naira, recentPayments, revenue } from "../../lib/queries";

/** Admin home: one hero, then only what has something to show (at most four blocks). See docs/PRODUCT.md. */
export default async function Home() {
  const ctx = await requireRole("admin");
  const clubId = ctx.club.clubId;
  const d = await inClub(ctx, async (tx) => ({
    members: await listMembers(tx, clubId),
    comps: await listCompetitions(tx, clubId),
    dues: await listDues(tx, clubId),
    plans: await listPlans(tx, clubId),
    month: await revenue(tx, clubId, "Month"),
    matches: await listMatches(tx, clubId),
    entries: await entryCounts(tx, clubId),
    pays: await recentPayments(tx, clubId, 8),
    venue: await getVenue(tx, clubId),
    clubPage: await hasClubPageContent(tx, clubId),
    applications: await pendingApplicationCount(tx, clubId),
    invite: (await tx.select({ id: invites.id }).from(invites).where(and(eq(invites.clubId, clubId), isNull(invites.revokedAt), or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())))).limit(1))[0],
  }));
  const payouts = await payoutsEnabled(ctx);
  const others = d.members.length - 1; // everyone except the founder
  const outstanding = d.dues.filter((x) => x.status === "due" || x.status === "overdue").reduce((a, x) => a + x.amountKobo, 0);
  const unpaid = d.dues.filter((x) => x.status === "due" || x.status === "overdue").length;
  const toScore = d.matches.filter((m) => (m.status === "scheduled" || m.status === "live") && m.p1 && m.p2).length;
  const readyToStart = d.comps.filter((c) => c.status === "draft" && (d.entries[c.id] ?? 0) >= 2);
  const running = d.comps.filter((c) => c.status === "active" || c.status === "draft").slice(0, 8);
  const hasMoney = d.month.total > 0 || d.dues.length > 0;
  const canM = can(ctx.club, "members"), canC = can(ctx.club, "competitions"), canF = can(ctx.club, "finance");

  const setup = setupProgress({ hasLogo: !!ctx.club.logoUrl, hasCover: !!ctx.club.coverUrl, hasCourt: !!d.venue, hasPlans: d.plans.length > 0, hasPayouts: payouts, hasInvited: !!d.invite || others > 0, hasCompetition: d.comps.length > 0, hasClubPage: d.clubPage });

  const feed = mergeActivity([ // each kind only for the admin who looks after it
    (canM ? groupRegistrations(d.members.filter((m) => m.joinedAt.getTime() > Date.now() - 30 * 86400000).map((m) => ({ id: m.id, name: m.name, at: m.joinedAt })), { hrefOne: (id) => `/members/${id}`, hrefGroup: "/members" }).slice(0, 5) : []),
    (canF ? d.pays : []).map<Activity>((p) => ({ id: `p${p.id}`, kind: "payment", at: p.paidAt ?? new Date(0), title: `${p.name} paid ${naira(p.amountKobo)}`, detail: "Payment", href: "/membership/payments" })),
    (canC ? d.matches : []).filter(isDone).sort(byRecent).slice(0, 5).map<Activity>((m) => ({ id: `m${m.id}`, kind: "result", at: m.confirmedAt ?? new Date(0), title: `${m.p1!.name} ${m.gamesP1}-${m.gamesP2} ${m.p2!.name}`, detail: m.competitionName, href: `/competition/${m.competitionId}/groups` })),
  ], 6);

  // Blocks in priority order; each renders only when it has something to say. At most four below the hero.
  const blocks: Array<{ key: string; show: boolean; node: React.ReactNode }> = [
    { key: "attention", show: (canM && d.applications > 0) || (canF && unpaid > 0) || (canC && (toScore > 0 || readyToStart.length > 0)), node: (
      <>
        <SectionTitle title="Needs your attention" />
        <ListGroup label="Needs your attention">
          {canM && d.applications > 0 ? <ListRow media={<IconBadge icon="user-add" />} title={`${d.applications} ${d.applications === 1 ? "person wants" : "people want"} to join`} subtitle="Review the applications" href="/members" linkAs={Link} /> : null}
          {canF && unpaid > 0 ? <ListRow media={<IconBadge icon="money" />} title={`${unpaid} unpaid ${unpaid === 1 ? "fee" : "fees"}`} subtitle={`${naira(outstanding)} outstanding`} href="/membership/payments" linkAs={Link} /> : null}
          {canC && toScore > 0 ? <ListRow media={<IconBadge icon="trophy" />} title={`${toScore} ${toScore === 1 ? "match" : "matches"} to score`} subtitle="Record the results" href="/competition" linkAs={Link} /> : null}
          {canC ? readyToStart.map((c) => <ListRow key={c.id} media={<IconBadge icon="play" />} title={`${c.name} is ready to start`} subtitle={`${d.entries[c.id] ?? 0} players signed up`} href={`/competition/${c.id}/groups`} linkAs={Link} />) : null}
        </ListGroup>
      </>) },
    { key: "setup", show: !setup.complete && ctx.club.isOwner, node: <Checklist title="Set up your club" steps={setup.steps} linkAs={Link} /> },
    { key: "stats", show: canF && setup.complete && others > 0 && hasMoney, node: (
      <MetricGrid three>
        <MetricCard label="Members" value={String(d.members.length)} />
        <MetricCard label="Outstanding" value={naira(outstanding)} tone={outstanding > 0 ? "bad" : undefined} />
        <MetricCard label="Revenue, 30 days" value={naira(d.month.total)} tone={d.month.total > 0 ? "good" : undefined} />
      </MetricGrid>) },
    { key: "comps", show: canC && running.length > 0, node: (
      <>
        <SectionTitle title="Competitions" href="/competition" linkAs={Link} label="See all competitions" />
        <Carousel label="Competitions">
          {running.map((c) => <MediaCard key={c.id} name={c.name} detail={`${d.entries[c.id] ?? 0} players${c.startsOn ? ` · ${dayLabel(new Date(`${c.startsOn}T12:00:00`))}` : ""}`} tag={c.status === "active" ? "Running" : c.openRegistration ? "Sign-up open" : "Draft"} cover={c.coverUrl} href={`/competition/${c.id}/groups`} linkAs={Link} />)}
        </Carousel>
      </>) },
    { key: "activity", show: feed.length > 0 && others > 0, node: (
      <>
        <SectionTitle title="Recent activity" href="/activity" linkAs={Link} label="See all activity" />
        <ListGroup label="Recent activity">
          {feed.map((a) => <ListRow key={a.id} media={<IconBadge icon={a.kind === "payment" ? "money" : a.kind === "result" ? "trophy" : "user-add"} />} title={a.title} subtitle={`${a.detail ?? ""} · ${dayLabel(a.at)}`} href={a.href} linkAs={Link} />)}
        </ListGroup>
      </>) },
  ];
  const shown = blocks.filter((b) => b.show).slice(0, 4);

  return (
    <PageShell home header={<ClubHeader />}
      lead={<ClubBanner name={ctx.club.name} logo={ctx.club.logoUrl} cover={ctx.club.coverUrl} figure={hasMoney ? naira(d.month.total) : undefined} figureLabel="Revenue, last 30 days" members={d.members.length} membersLabel={d.members.length === 1 ? "Member" : "Members"} />}>
      {shown.map((b) => <div className="rx-block" key={b.key}>{b.node}</div>)}
      {shown.length === 0 && !ctx.club.isOwner ? <EmptyState compact title="Nothing needs you right now" hint={ctx.club.permissions.length ? "New things for your areas will show up here." : "The club owner chooses what each admin looks after. Ask them to give you a responsibility."} /> : null}
    </PageShell>
  );
}
