import Link from "next/link";
import { Carousel, Celebrations, EmptyState, ListGroup, ListRow, MediaCard, MetricCard, MetricGrid, PageShell, Photo, Pill, ResultCard, SectionTitle, Stories } from "@rallix/ui";
import { streakLabel } from "@rallix/stats";
import { ClubHeader } from "../../../components/ClubHeader";
import { PayButton } from "../../../components/PayButton";
import { inClub, requireClub } from "../../../lib/context";
import { payoutsEnabled } from "../../../lib/payment-queries";
import { buildStories, byRecent, dayLabel, isDone, todayInClub, winnerSide } from "../../../lib/highlights";
import { celebrations } from "@rallix/stats";
import { listCompetitions, listDues, listMatches, listMembers, memberStats, naira } from "../../../lib/queries";

const first = (n: string) => n.split(/\s+/)[0] ?? n;
const when = (d: Date | null) => (d ? d.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Date to be confirmed");

export default async function PlayerHome() {
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const d = await inClub(ctx, async (tx) => ({
    clubMatches: await listMatches(tx, ctx.club.clubId),
    dues: await listDues(tx, ctx.club.clubId, me),
    stats: await memberStats(tx, ctx.club.clubId, me),
    members: await listMembers(tx, ctx.club.clubId),
    comps: await listCompetitions(tx, ctx.club.clubId, me),
    allComps: await listCompetitions(tx, ctx.club.clubId),
  }));
  const payOn = await payoutsEnabled(ctx);
  const mineAll = d.clubMatches.filter((m) => m.p1?.id === me || m.p2?.id === me);
  const celebs = celebrations(d.members.map((x) => ({ id: x.id, name: x.name, photo: x.photo, dob: x.dob, joinedAt: x.joinedAt })), todayInClub());
  const done = d.clubMatches.filter(isDone).sort(byRecent).slice(0, 8);
  const stories = buildStories(d.clubMatches, (m) => `/play/compete/${m.competitionId}`, "See the draw");
  const due = d.dues.find((x) => x.status === "due" || x.status === "overdue");
  const mine = d.members.find((m) => m.id === me);
  const r = d.stats.record;
  const myDone = mineAll.filter(isDone).sort(byRecent).slice(0, 8);
  const results = myDone.length ? myDone : done;
  const upcoming = d.allComps.filter((c) => c.status === "active" || c.status === "draft").slice(0, 8);
  const top5 = d.members.slice(0, 5);
  const lastWin = done[0] ? (winnerSide(done[0]) === "a" ? done[0].p1 : done[0].p2) : null;
  const lastWinner = lastWin ? d.members.find((m) => m.id === lastWin.id) ?? null : null;
  const next = mineAll.filter((m) => (m.status === "scheduled" || m.status === "live") && m.p1 && m.p2)
    .sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0) || (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity)).slice(0, 8);
  const dueDay = due ? dayLabel(new Date(`${due.dueDate}T12:00:00`)) : "";

  const vs = (m: (typeof next)[number]) => `${first(m.p1!.id === me ? m.p2!.name : m.p1!.name)}`;
  return (
    <PageShell home header={<ClubHeader />} title={`Hi, ${first(ctx.user.name)}`} band={<Stories items={stories} label="Match highlights" />}>
      {due ? (
        <div className="rx-duebar" role="status">
          <p>{naira(due.amountKobo)} {due.status === "overdue" ? "overdue" : `due ${dueDay}`}</p>
          <PayButton dueId={due.id} amount={naira(due.amountKobo)} enabled={payOn} />
        </div>
      ) : null}

      <SectionTitle title="My performance" href="/play/stats" linkAs={Link} label="See my stats" />
      <MetricGrid kpi>
        <MetricCard label="Ranking" value={mine ? `#${mine.rank}` : "—"} hint={mine ? `of ${d.members.length}` : undefined} />
        <MetricCard label="Rating" value={mine ? String(mine.rating) : "—"} hint="points" />
        <MetricCard label="Win rate" value={r.played ? `${r.winPct}%` : "—"} hint={r.played ? `Streak: ${streakLabel(r.streak)}` : undefined} tone={r.played && r.winPct >= 50 ? "good" : undefined} />
      </MetricGrid>

      {next.length ? (
        <>
          <SectionTitle title="Upcoming matches" href="/play/compete" linkAs={Link} label="See all competitions" />
          <Carousel label="Upcoming matches">
            {next.map((m) => <MediaCard key={m.id} name={`vs ${vs(m)}`} detail={`${m.competitionName} · ${m.status === "live" ? "Live now" : when(m.scheduledAt)}`} tag={m.status === "live" ? "Live" : "Next"} href={`/play/compete/${m.competitionId}`} linkAs={Link} />)}
          </Carousel>
        </>
      ) : null}

      {results.length ? (
        <>
          <SectionTitle title="Latest results" href="/play/compete" linkAs={Link} label="See all competitions" />
          <Carousel label="Recent results">
            {results.map((m) => <ResultCard key={m.id} a={m.p1!} b={m.p2!} scoreA={m.gamesP1} scoreB={m.gamesP2} winner={winnerSide(m)} competition={m.competitionName} when={dayLabel(m.confirmedAt)} href={`/play/compete/${m.competitionId}`} linkAs={Link} />)}
          </Carousel>
        </>
      ) : null}

      {top5.length ? (
        <>
          <SectionTitle title="Leaderboard" href="/play/ranks" linkAs={Link} label="See the full leaderboard" />
          <ListGroup label="Top five players">
            {top5.map((m) => <ListRow key={m.id} media={<Photo src={m.photo} name={m.name} alt="" />} eyebrow={`#${m.rank}`} title={m.id === me ? `${m.name} (you)` : m.name} subtitle={`Rating ${m.rating}`} current={m.id === me} href="/play/ranks" linkAs={Link} />)}
          </ListGroup>
        </>
      ) : null}

      {upcoming.length ? (
        <>
          <SectionTitle title="Upcoming competitions" href="/play/compete" linkAs={Link} label="See all competitions" />
          <Carousel label="Upcoming competitions">
            {upcoming.map((c) => <MediaCard key={c.id} name={c.name} detail={c.startsOn ? `Starts ${dayLabel(new Date(`${c.startsOn}T12:00:00`))}` : (c.level ?? "Open to all")} tag={c.status === "active" ? "Active" : "Soon"} href={`/play/compete/${c.id}`} linkAs={Link} />)}
          </Carousel>
        </>
      ) : null}

      {celebs.length || lastWinner ? (
        <>
          <SectionTitle title="Club updates" />
          {celebs.length ? <Celebrations items={celebs} /> : null}
          {lastWinner ? (
            <ListGroup label="Featured player">
              <ListRow media={<Photo src={lastWinner.photo} name={lastWinner.name} alt="" />} eyebrow="Featured player" title={lastWinner.name} subtitle={`Won the latest result · rating ${lastWinner.rating}`} trailing={<Pill tone="success">Winner</Pill>} />
            </ListGroup>
          ) : null}
        </>
      ) : null}

      {!next.length && results.length === 0 && upcoming.length === 0 ? <EmptyState title="Nothing on yet" hint="When your club schedules matches, they show up here." /> : null}
    </PageShell>
  );
}
