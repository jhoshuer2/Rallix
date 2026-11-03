import Link from "next/link";
import { ActionButton, Carousel, ClubBanner, EmptyState, ListGroup, ListRow, MediaCard, MetricCard, MetricGrid, PageShell, Panel, Photo, SectionTitle, StackedBar } from "@rallix/ui";
import { groupRegistrations, mergeActivity, membershipOverview, type Activity } from "@rallix/stats";
import { ClubHeader } from "../../components/ClubHeader";
import { inClub, requireRole } from "../../lib/context";
import { byRecent, dayLabel, isDone, todayInClub } from "../../lib/highlights";
import { entryCounts, listCompetitions, listDues, listMatches, listMembers, naira, recentPayments, revenue } from "../../lib/queries";

export default async function Home() {
  const ctx = await requireRole("admin");
  const clubId = ctx.club.clubId;
  const d = await inClub(ctx, async (tx) => ({
    members: await listMembers(tx, clubId),
    comps: await listCompetitions(tx, clubId),
    dues: await listDues(tx, clubId),
    month: await revenue(tx, clubId, "Month"),
    matches: await listMatches(tx, clubId),
    entries: await entryCounts(tx, clubId),
    pays: await recentPayments(tx, clubId, 8),
  }));
  const today = todayInClub();
  const ov = membershipOverview(d.dues, today);
  const outstanding = d.dues.filter((x) => x.status === "due" || x.status === "overdue").reduce((a, x) => a + x.amountKobo, 0);
  const comps = d.comps.filter((c) => c.status === "active" || c.status === "draft").slice(0, 8);
  const feed = mergeActivity([
    groupRegistrations(d.members.filter((m) => m.joinedAt.getTime() > Date.now() - 30 * 86400000).map((m) => ({ id: m.id, name: m.name, at: m.joinedAt })), { hrefOne: (id) => `/members/${id}`, hrefGroup: "/members" }).slice(0, 5),
    d.pays.map<Activity>((p) => ({ id: `p${p.id}`, kind: "payment", at: p.paidAt ?? new Date(0), title: `${p.name} paid ${naira(p.amountKobo)}`, detail: "Payment", href: "/membership/payments" })),
    d.matches.filter(isDone).sort(byRecent).slice(0, 5).map<Activity>((m) => ({ id: `m${m.id}`, kind: "result", at: m.confirmedAt ?? new Date(0), title: `${m.p1!.name} ${m.gamesP1}-${m.gamesP2} ${m.p2!.name}`, detail: m.competitionName, href: `/competition/${m.competitionId}/groups` })),
  ], 8);
  const top = d.members.slice(0, 5);
  return (
    <PageShell home header={<ClubHeader />}
      lead={<ClubBanner name={ctx.club.name} logo={ctx.club.logoUrl} cover={ctx.club.coverUrl} figure={naira(d.month.total)} figureLabel="Revenue, last 30 days" members={d.members.length} />}>

      <SectionTitle title="Club overview" />
      <MetricGrid kpi>
        <MetricCard label="Members" value={String(d.members.length)} />
        <MetricCard label="Active memberships" value={String(ov.active)} hint={ov.total ? `of ${ov.total} on a plan` : undefined} />
        <MetricCard label="Revenue (30 days)" value={naira(d.month.total)} tone="good" />
        <MetricCard label="Outstanding" value={naira(outstanding)} tone={outstanding > 0 ? "bad" : undefined} hint={outstanding > 0 ? "Not yet paid" : undefined} />
      </MetricGrid>

      <SectionTitle title="Quick actions" />
      <div className="rx-actions">
        <ActionButton icon="user-add" label="Add member" href="/profile" linkAs={Link} />
        <ActionButton icon="trophy" label="Competition" href="/competition/new" linkAs={Link} />
        <ActionButton icon="play" label="Record match" href="/competition" linkAs={Link} />
      </div>

      <SectionTitle title="Upcoming competitions" href="/competition" linkAs={Link} label="See all competitions" />
      {comps.length ? (
        <Carousel label="Upcoming competitions">
          {comps.map((c) => <MediaCard key={c.id} name={c.name} detail={`${d.entries[c.id] ?? 0} registered${c.startsOn ? ` · ${dayLabel(new Date(`${c.startsOn}T12:00:00`))}` : ""}`} tag={c.status === "active" ? "Active" : c.openRegistration ? "Sign-up open" : "Draft"} cover={c.coverUrl} href={`/competition/${c.id}/groups`} linkAs={Link} />)}
        </Carousel>
      ) : <EmptyState compact title="No competitions yet" hint="Create one to get players registering." />}

      <SectionTitle title="Membership overview" href="/membership/payments" linkAs={Link} label="See payments" />
      <Panel>
        <StackedBar label="Membership status" parts={[{ label: "paid", value: ov.paid, tone: "good" }, { label: "expiring", value: ov.expiring, tone: "warn" }, { label: "unpaid", value: ov.unpaid, tone: "bad" }]} />
      </Panel>

      {feed.length ? (
        <>
          <SectionTitle title="Recent activity" href="/activity" linkAs={Link} label="See all activity" />
          <ListGroup label="Recent activity">
            {feed.map((a) => <ListRow key={a.id} media={<Photo name={a.title} alt="" />} title={a.title} subtitle={`${a.detail ?? ""} · ${dayLabel(a.at)}`} href={a.href} linkAs={Link} />)}
          </ListGroup>
        </>
      ) : null}

      {top.length ? (
        <>
          <SectionTitle title="Top players" href="/members" linkAs={Link} label="See all members" />
          <ListGroup label="Top players">
            {top.map((m) => <ListRow key={m.id} media={<Photo src={m.photo} name={m.name} alt="" />} eyebrow={`#${m.rank}`} title={m.name} subtitle={`Rating ${m.rating}`} href={`/members/${m.id}`} linkAs={Link} />)}
          </ListGroup>
        </>
      ) : null}
    </PageShell>
  );
}
