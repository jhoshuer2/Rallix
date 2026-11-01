import Link from "next/link";
import { Carousel, HeroMatch, MediaCard, MetricCard, MetricGrid, PageShell, ResultCard, SectionTitle, Stories } from "@rallix/ui";
import { streakLabel } from "@rallix/stats";
import { ClubHeader } from "../../../components/ClubHeader";
import { PayButton } from "../../../components/PayButton";
import { inClub, requireClub } from "../../../lib/context";
import { payoutsEnabled } from "../../../lib/payment-queries";
import { buildStories, byRecent, dayLabel, isDone, winnerSide } from "../../../lib/highlights";
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
  }));
  const payOn = await payoutsEnabled(ctx);
  const mineAll = d.clubMatches.filter((m) => m.p1?.id === me || m.p2?.id === me);
  const done = d.clubMatches.filter(isDone).sort(byRecent).slice(0, 8);
  const stories = buildStories(d.clubMatches, (m) => `/play/compete/${m.competitionId}`, "See the draw");
  const hero = mineAll.filter((m) => (m.status === "scheduled" || m.status === "live") && m.p1 && m.p2)
    .sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0) || (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity))[0];
  const due = d.dues.find((x) => x.status === "due" || x.status === "overdue");
  const mine = d.members.find((m) => m.id === me);
  const r = d.stats.record;
  const myDone = mineAll.filter(isDone).sort(byRecent).slice(0, 8);
  const results = myDone.length ? myDone : done;
  const active = d.comps.filter((c) => c.status === "active");
  const dueDay = due ? dayLabel(new Date(`${due.dueDate}T12:00:00`)) : "";

  return (
    <PageShell header={<ClubHeader />} title={`Hi, ${first(ctx.user.name)}`} band={<Stories items={stories} label="Match highlights" />}>
      {hero ? (
        <HeroMatch competition={hero.competitionName} whenLabel={when(hero.scheduledAt)} startsAt={hero.status === "live" ? null : hero.scheduledAt} live={hero.status === "live"}
          a={hero.p1!} b={hero.p2!} scoreA={hero.status === "live" ? hero.gamesP1 : null} scoreB={hero.status === "live" ? hero.gamesP2 : null}
          href={`/play/compete/${hero.competitionId}`} linkAs={Link} cta={hero.status === "live" ? "Follow live" : "Match details"} />
      ) : null}

      {due ? (
        <div className="rx-duebar" role="status">
          <p>{naira(due.amountKobo)} {due.status === "overdue" ? "overdue" : `due ${dueDay}`}</p>
          <PayButton dueId={due.id} amount={naira(due.amountKobo)} enabled={payOn} />
        </div>
      ) : null}

      <SectionTitle title="My standing" href="/play/stats" linkAs={Link} label="See my stats" />
      <MetricGrid>
        <MetricCard label="Club rank" value={mine ? `#${mine.rank}` : "—"} hint={mine ? `Rating ${mine.rating}` : undefined} />
        <MetricCard label="Win rate" value={r.played ? `${r.winPct}%` : "—"} hint={r.played ? `Streak: ${streakLabel(r.streak)}` : undefined} tone={r.played && r.winPct >= 50 ? "good" : undefined} />
      </MetricGrid>

      {results.length ? (
        <>
          <SectionTitle title={myDone.length ? "My results" : "Latest results"} href="/play/compete" linkAs={Link} label="See all competitions" />
          <Carousel label="Recent results">
            {results.map((m) => <ResultCard key={m.id} a={m.p1!} b={m.p2!} scoreA={m.gamesP1} scoreB={m.gamesP2} winner={winnerSide(m)} competition={m.competitionName} when={dayLabel(m.confirmedAt)} href={`/play/compete/${m.competitionId}`} linkAs={Link} />)}
          </Carousel>
        </>
      ) : null}

      {active.length ? (
        <>
          <SectionTitle title="My competitions" href="/play/compete" linkAs={Link} label="See all competitions" />
          <Carousel label="My competitions">
            {active.map((c) => <MediaCard key={c.id} name={c.name} detail={c.level ?? "In progress"} tag="Active" href={`/play/compete/${c.id}`} linkAs={Link} />)}
          </Carousel>
        </>
      ) : null}

      {!hero && results.length === 0 && active.length === 0 ? <p className="rx-muted" style={{ marginTop: 24 }}>Nothing on yet. When your club schedules matches, they show up here.</p> : null}
    </PageShell>
  );
}
