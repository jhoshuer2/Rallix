import Link from "next/link";
import { ActionButton, AttentionTile, Carousel, ClubBanner, CoverCard, ResultCard, SectionTitle, Stories } from "@rallix/ui";
import { ClubHeader } from "../../components/ClubHeader";
import { inClub, requireRole } from "../../lib/context";
import { buildStories, byRecent, dayLabel, isDone, winnerSide } from "../../lib/highlights";
import { listCompetitions, listDues, listMatches, listMembers, naira, revenue } from "../../lib/queries";

export default async function Home() {
  const ctx = await requireRole("admin");
  const { members, comps, dues, month, matches } = await inClub(ctx, async (tx) => ({
    members: await listMembers(tx, ctx.club.clubId),
    comps: await listCompetitions(tx, ctx.club.clubId),
    dues: await listDues(tx, ctx.club.clubId),
    month: await revenue(tx, ctx.club.clubId, "Month"),
    matches: await listMatches(tx, ctx.club.clubId),
  }));
  const unpaid = dues.filter((d) => d.status === "due" || d.status === "overdue").length;
  const toScore = matches.filter((m) => (m.status === "scheduled" || m.status === "live") && m.p1 && m.p2).length;
  const active = comps.filter((c) => c.status === "active");
  const results = matches.filter(isDone).sort(byRecent).slice(0, 8);
  const stories = buildStories(matches, (m) => `/competition/${m.competitionId}/groups`, "Open match");
  const needs = unpaid > 0 || toScore > 0 || active.length === 0;
  return (
    <>
      <ClubHeader />
      <ClubBanner name={ctx.club.name} logo={ctx.club.logoUrl} figure={naira(month.total)} figureLabel="Revenue, last 30 days" members={members.length} />

      {needs ? (
        <div className="rx-attn-row" aria-label="Needs your attention">
          {unpaid > 0 ? <AttentionTile count={unpaid} label={unpaid === 1 ? "unpaid due" : "unpaid dues"} href="/membership/payments" linkAs={Link} /> : null}
          {toScore > 0 ? <AttentionTile count={toScore} label={toScore === 1 ? "match to score" : "matches to score"} href="/competition" linkAs={Link} /> : null}
          {active.length === 0 ? <AttentionTile label="Start a competition" href="/competition/new" tone="go" linkAs={Link} /> : null}
        </div>
      ) : null}

      <div className="rx-actions">
        <ActionButton icon="trophy" label="New event" href="/competition/new" linkAs={Link} />
        <ActionButton icon="members" label="Invite" href="/profile" linkAs={Link} />
        <ActionButton icon="money" label="Payments" href="/membership/payments" linkAs={Link} />
      </div>

      <Stories items={stories} label="Match highlights" />

      {active.length ? (
        <>
          <SectionTitle title="Competitions" href="/competition" linkAs={Link} label="See all competitions" />
          <Carousel label="Active competitions">
            {active.map((c) => <CoverCard key={c.id} name={c.name} detail={c.level ?? "In progress"} tag="Active" href={`/competition/${c.id}/groups`} linkAs={Link} />)}
          </Carousel>
        </>
      ) : null}

      {results.length ? (
        <>
          <SectionTitle title="Latest results" href="/competition" linkAs={Link} label="See all competitions" />
          <Carousel label="Recent results">
            {results.map((m) => <ResultCard key={m.id} a={m.p1!} b={m.p2!} scoreA={m.gamesP1} scoreB={m.gamesP2} winner={winnerSide(m)} competition={m.competitionName} when={dayLabel(m.confirmedAt)} href={`/competition/${m.competitionId}/groups`} linkAs={Link} />)}
          </Carousel>
        </>
      ) : null}
    </>
  );
}
