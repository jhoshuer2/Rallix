import { accountStatus } from "../../../lib/account-queries";
import Link from "next/link";
import { Carousel, Celebrations, Checklist, EmptyState, HeroMatch, ListGroup, ListRow, MediaCard, MetricCard, MetricGrid, PageShell, Photo, ResultCard, SectionTitle, SpotsFaces, Stories } from "@rallix/ui";
import { streakLabel } from "@rallix/stats";
import { ClubHeader } from "../../../components/ClubHeader";
import { PayButton } from "../../../components/PayButton";
import { ArrivalCard } from "../../../components/ArrivalCard";
import { getArrivalSettings, getVenue, listHere } from "../../../lib/arrival-queries";
import { inClub, requireClub } from "../../../lib/context";
import { payoutsEnabled } from "../../../lib/payment-queries";
import { buildStories, byRecent, dayLabel, isDone, todayInClub, winnerSide } from "../../../lib/highlights";
import { closureNotice, doorsLabel, occurrences, timeLabel, celebrationTiles, celebrations, playerStart, spotsLabel, spotsLeftLabel } from "@rallix/stats";
import { listScheduleEvents } from "../../../lib/schedule-queries";
import { listMyChallenges, needsMe } from "../../../lib/friendly-queries";
import { listCompetitionsForPlayer, listDues, listMatches, listMembers, memberStats, naira } from "../../../lib/queries";

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
    allComps: await listCompetitionsForPlayer(tx, ctx.club.clubId, me),
    venue: await getVenue(tx, ctx.club.clubId),
    here: await listHere(tx, ctx.club.clubId),
    arrival: await getArrivalSettings(tx, me),
    friendlies: await listMyChallenges(tx, ctx.club.clubId, me),
    schedule: await listScheduleEvents(tx, ctx.club.clubId),
  }));
  const closed = closureNotice(d.schedule, todayInClub());
  const session = occurrences(d.schedule, todayInClub(), todayInClub()).find((o) => o.kind === "play");
  const sessionLine = session ? `${session.title} · ${doorsLabel(session) ?? timeLabel(session)}` : null;
  const asks = needsMe(d.friendlies, me);
  const payOn = await payoutsEnabled(ctx);
  const mineAll = d.clubMatches.filter((m) => m.p1?.id === me || m.p2?.id === me);
  const celebs = celebrations(d.members.filter((x) => x.id !== me).map((x) => ({ id: x.id, name: x.name, photo: x.photo, dob: x.dob, joinedAt: x.joinedAt })), todayInClub());
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
  const hero = next[0];
  const comingMatches = next.slice(1);
  const hasComing = comingMatches.length > 0 || upcoming.length > 0;
  const start = playerStart({ hasPhoto: !!mine?.photo, levelSet: true, playedMatch: r.played > 0, alertsOn: d.arrival.notify, hasPassword: (await accountStatus(ctx.user.id)).hasPassword });

  // Blocks in priority order; each shows only when it has something to say. At most four below the hero (see docs/PRODUCT.md).
  const blocks: Array<{ key: string; show: boolean; node: React.ReactNode }> = [
    { key: "start", show: r.played === 0 && start.some((x) => !x.done), node: <Checklist title="Getting started" steps={start.map((x) => ({ ...x, hint: undefined }))} linkAs={Link} /> },
    { key: "coming", show: hasComing, node: (
      <>
        <SectionTitle title="Coming up" href="/play/compete" linkAs={Link} label="See all competitions" />
        <Carousel label="Coming up">
          {comingMatches.map((m) => <MediaCard key={m.id} name={`vs ${vs(m)}`} detail={`${m.competitionName} · ${m.status === "live" ? "Live now" : when(m.scheduledAt)}`} tag={m.status === "live" ? "Live" : "Next"} href={`/play/compete/${m.competitionId}`} linkAs={Link} />)}
          {upcoming.map((c) => <MediaCard key={c.id} name={c.name} cover={c.coverUrl} foot={c.status === "draft" ? <SpotsFaces left={spotsLeftLabel(c.entries, c.maxPlayers)} faces={c.faces} /> : undefined} detail={c.status === "draft" ? spotsLabel(c.entries, c.maxPlayers) : c.startsOn ? `Started ${dayLabel(new Date(`${c.startsOn}T12:00:00`))}` : (c.level ?? "Open to all")} tag={c.registered ? "Registered" : c.status === "draft" ? "Open" : "Active"} href={`/play/compete/${c.id}`} linkAs={Link} />)}
        </Carousel>
      </>) },
    { key: "court", show: !!d.venue, node: <ArrivalCard today={sessionLine} venueLabel={d.venue?.label ?? null} here={d.here.map((h) => ({ id: h.id, name: h.name, photo: h.photo, since: h.since.toISOString() }))} iAmHere={d.here.some((h) => h.membershipId === me)} share={d.arrival.share} auto={d.arrival.auto} /> },
    { key: "performance", show: r.played > 0, node: (
      <>
        <SectionTitle title="My performance" href="/play/stats" linkAs={Link} label="See my stats" />
        <MetricGrid three>
          <MetricCard label="Ranking" value={mine ? `#${mine.rank}` : "—"} hint={mine ? `of ${d.members.length}` : undefined} />
          <MetricCard label="Rating" value={mine ? String(mine.rating) : "—"} />
          <MetricCard label="Win rate" value={`${r.winPct}%`} tone={r.winPct >= 50 ? "good" : undefined} />
        </MetricGrid>
      </>) },
    { key: "results", show: results.length > 0, node: (
      <>
        <SectionTitle title={myDone.length ? "My results" : "Latest results"} href="/play/compete" linkAs={Link} label="See all competitions" />
        <Carousel label="Recent results">
          {results.map((m) => <ResultCard key={m.id} a={m.p1!} b={m.p2!} scoreA={m.gamesP1} scoreB={m.gamesP2} winner={winnerSide(m)} competition={m.competitionName} when={dayLabel(m.confirmedAt)} href={`/play/compete/${m.competitionId}`} linkAs={Link} />)}
        </Carousel>
      </>) },
    { key: "updates", show: celebs.length > 0, node: <><SectionTitle title="Club updates" href="/play/updates" linkAs={Link} label="See all club updates" /><Celebrations tiles={celebrationTiles(celebs)} allHref="/play/updates" linkAs={Link} /></> },
  ];
  const shown = blocks.filter((b) => b.show).slice(0, 4);

  return (
    <PageShell home header={<ClubHeader />} title={`Hi, ${first(ctx.user.name)}`} band={stories.length ? <Stories items={stories} label="Match highlights" /> : undefined}
      lead={hero ? (
        <HeroMatch competition={hero.competitionName} whenLabel={when(hero.scheduledAt)} startsAt={hero.status === "live" ? null : hero.scheduledAt} live={hero.status === "live"}
          a={hero.p1!} b={hero.p2!} scoreA={hero.status === "live" ? hero.gamesP1 : null} scoreB={hero.status === "live" ? hero.gamesP2 : null}
          href={`/play/compete/${hero.competitionId}`} linkAs={Link} cta={hero.status === "live" ? "Follow live" : "Match details"} />
      ) : null}>
      {closed ? <p className="rx-muted" role="status" style={{ margin: "0 0 12px" }}>{closed}</p> : null}
      {due ? (
        <div className="rx-duebar" role="status">
          <p>{naira(due.amountKobo)} {due.status === "overdue" ? "overdue" : `due ${dueDay}`}</p>
          <PayButton dueId={due.id} amount={naira(due.amountKobo)} enabled={payOn} />
        </div>
      ) : null}
      {asks.length ? (
        <div className="rx-block">
          <ListGroup label="Friendlies waiting for you">
            {asks.slice(0, 3).map((c) => { const o = c.challengerId === me ? c.opponent : c.challenger; return <ListRow key={c.id} media={<Photo src={o.photo} name={o.name} alt="" />} title={c.status === "proposed" ? `${first(o.name)} challenged you` : `Confirm your score with ${first(o.name)}`} subtitle="Friendly match" href={`/play/friendlies/${c.id}`} linkAs={Link} />; })}
          </ListGroup>
        </div>
      ) : null}
      {shown.map((b) => <div className="rx-block" key={b.key}>{b.node}</div>)}
      {!hero && shown.length === 0 && !due && !asks.length ? <EmptyState title="Nothing on yet" hint="When your club schedules matches or opens a competition, it shows up here." /> : null}
    </PageShell>
  );
}
