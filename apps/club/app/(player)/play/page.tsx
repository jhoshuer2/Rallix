import Link from "next/link";
import { Carousel, CoverCard, HeroMatch, ResultCard, SectionTitle, Stories, type StoryItem } from "@rallix/ui";
import { streakLabel } from "@rallix/stats";
import { ClubHeader } from "../../../components/ClubHeader";
import { PayButton } from "../../../components/PayButton";
import { inClub, requireClub } from "../../../lib/context";
import { payoutsEnabled } from "../../../lib/payment-queries";
import { listCompetitions, listDues, listMatches, listMembers, memberStats, naira, type MatchView } from "../../../lib/queries";

const first = (n: string) => n.split(/\s+/)[0] ?? n;
const isDone = (m: MatchView) => (m.status === "completed" || m.status === "walkover") && !!m.p1 && !!m.p2;
const when = (d: Date | null) => (d ? d.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Date to be confirmed");
const day = (d: Date | null) => (d ? d.toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "");
const winnerSide = (m: MatchView) => (m.winnerId ? (m.winnerId === m.p1?.id ? ("a" as const) : ("b" as const)) : null);

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
  const byRecent = (a: MatchView, b: MatchView) => (b.confirmedAt?.getTime() ?? 0) - (a.confirmedAt?.getTime() ?? 0);
  const mineAll = d.clubMatches.filter((m) => m.p1?.id === me || m.p2?.id === me);

  // Highlights: live first, then the latest club results.
  const live = d.clubMatches.filter((m) => m.status === "live" && m.p1 && m.p2);
  const done = d.clubMatches.filter(isDone).sort(byRecent).slice(0, 8);
  const stories: StoryItem[] = [...live, ...done].map((m) => ({
    id: m.id, live: m.status === "live", caption: m.status === "live" ? `${first(m.p1!.name)} v ${first(m.p2!.name)}` : `${first(m.p1!.name)} ${m.gamesP1}–${m.gamesP2} ${first(m.p2!.name)}`,
    title: m.competitionName, subtitle: m.status === "live" ? m.round : `${m.round} · ${day(m.confirmedAt)}`, a: m.p1!, b: m.p2!,
    score: `${m.gamesP1}–${m.gamesP2}`, href: `/play/compete/${m.competitionId}`, cta: "See the draw",
  }));

  // Hero: my live match, else my next one.
  const mineOpen = mineAll.filter((m) => (m.status === "scheduled" || m.status === "live") && m.p1 && m.p2)
    .sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0) || (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity));
  const hero = mineOpen[0];
  const due = d.dues.find((x) => x.status === "due" || x.status === "overdue");
  const mine = d.members.find((m) => m.id === me);
  const r = d.stats.record;
  const myDone = mineAll.filter(isDone).sort(byRecent).slice(0, 8);
  const results = myDone.length ? myDone : done;
  const active = d.comps.filter((c) => c.status === "active");

  return (
    <>
      <ClubHeader />
      <h1 className="rx-title" style={{ fontSize: 26, margin: "8px 0 0" }}>Hi, {first(ctx.user.name)}</h1>
      <Stories items={stories} label="Match highlights" />

      {hero ? (
        <HeroMatch competition={hero.competitionName} whenLabel={when(hero.scheduledAt)} startsAt={hero.status === "live" ? null : hero.scheduledAt} live={hero.status === "live"}
          a={hero.p1!} b={hero.p2!} scoreA={hero.status === "live" ? hero.gamesP1 : null} scoreB={hero.status === "live" ? hero.gamesP2 : null}
          href={`/play/compete/${hero.competitionId}`} linkAs={Link} cta={hero.status === "live" ? "Follow live" : "Match details"} />
      ) : null}

      {due ? (
        <div className="rx-duebar" role="status">
          <p>{naira(due.amountKobo)} {due.status === "overdue" ? "overdue" : `due ${day(new Date(`${due.dueDate}T12:00:00`))}`}</p>
          <PayButton dueId={due.id} amount={naira(due.amountKobo)} enabled={payOn} />
        </div>
      ) : null}

      <SectionTitle title="My standing" href="/play/stats" linkAs={Link} label="See my stats" />
      <Link href="/play/stats" className="rx-standing" aria-label={`Club rank ${mine ? mine.rank : "none"}. Win rate ${r.played ? r.winPct + " percent" : "none"}. Rating ${mine ? mine.rating : "none"}. Streak ${streakLabel(r.streak)}.`}>
        <span className="rx-standing__rank"><small>Club rank</small>{mine ? `#${mine.rank}` : "—"}</span>
        <span className="rx-standing__row" aria-hidden="true">
          <div><b>{r.played ? `${r.winPct}%` : "—"}</b><span>Win rate</span></div>
          <div><b>{mine ? mine.rating : "—"}</b><span>Rating</span></div>
          <div><b>{streakLabel(r.streak)}</b><span>Streak</span></div>
        </span>
      </Link>

      {results.length ? (
        <>
          <SectionTitle title={myDone.length ? "My results" : "Latest results"} href="/play/compete" linkAs={Link} label="See all competitions" />
          <Carousel label="Recent results">
            {results.map((m) => (
              <ResultCard key={m.id} a={m.p1!} b={m.p2!} scoreA={m.gamesP1} scoreB={m.gamesP2} winner={winnerSide(m)} competition={m.competitionName} when={day(m.confirmedAt)} href={`/play/compete/${m.competitionId}`} linkAs={Link} />
            ))}
          </Carousel>
        </>
      ) : null}

      {active.length ? (
        <>
          <SectionTitle title="My competitions" href="/play/compete" linkAs={Link} label="See all competitions" />
          <Carousel label="My competitions">
            {active.map((c) => <CoverCard key={c.id} name={c.name} detail={c.level ?? "In progress"} tag="Active" href={`/play/compete/${c.id}`} linkAs={Link} />)}
          </Carousel>
        </>
      ) : null}

      {!hero && results.length === 0 && active.length === 0 ? <p className="rx-muted" style={{ marginTop: 24 }}>Nothing on yet. When your club schedules matches, they show up here.</p> : null}
    </>
  );
}
