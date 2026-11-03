import Link from "next/link";
import { BackButton, EmptyState, ListGroup, ListRow, PageShell, Photo, Pill, SectionTitle } from "@rallix/ui";
import { isRated, nextStep, winnerOf } from "@rallix/stats";
import { inClub, requireClub } from "../../../../lib/context";
import { listMyChallenges, needsMe, type ChallengeView } from "../../../../lib/friendly-queries";

export const dynamic = "force-dynamic";
const day = (d: Date | null) => (d ? d.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "No time set");

/** Friendly matches with other members: what needs you, what is coming, and what you have played. */
export default async function Friendlies() {
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const all = await inClub(ctx, (tx) => listMyChallenges(tx, ctx.club.clubId, me));
  const need = needsMe(all, me);
  const needIds = new Set(need.map((c) => c.id));
  const coming = all.filter((c) => ["proposed", "accepted", "awaiting"].includes(c.status) && !needIds.has(c.id));
  const played = all.filter((c) => c.status === "confirmed");
  const other = (c: ChallengeView) => (c.challengerId === me ? c.opponent : c.challenger);
  const row = (c: ChallengeView, subtitle: string, trailing?: React.ReactNode) => {
    const o = other(c);
    return <ListRow key={c.id} media={<Photo src={o.photo} name={o.name} alt="" />} title={o.name} subtitle={subtitle} trailing={trailing} href={`/play/friendlies/${c.id}`} linkAs={Link} />;
  };
  const step = (c: ChallengeView) => nextStep(c, me);
  const ask = (c: ChallengeView) => (step(c) === "answer" ? `Challenged you · ${day(c.proposedFor)}` : "Entered a score for you to confirm");
  const state = (c: ChallengeView) => ({ proposed: "Waiting for an answer", accepted: day(c.proposedFor), awaiting: "Waiting for confirmation" } as Record<string, string>)[c.status] ?? "";
  const result = (c: ChallengeView) => {
    const mineGames = c.challengerId === me ? c.challengerGames : c.opponentGames, theirs = c.challengerId === me ? c.opponentGames : c.challengerGames;
    return `${mineGames}–${theirs}`;
  };
  return (
    <PageShell back={<BackButton href="/play/compete" linkAs={Link} />} title="Friendlies">
      {all.length === 0 ? (
        <EmptyState title="No friendlies yet" hint="Pick a player on the Ranks page and challenge them to a game."
          action={<Link href="/play/ranks" className="rx-btn rx-btn--primary">Find a player</Link>} />
      ) : null}
      {need.length ? <><SectionTitle title="Needs you" /><ListGroup label="Needs you">{need.map((c) => row(c, ask(c), <Pill tone="warning">{step(c) === "answer" ? "Answer" : "Confirm"}</Pill>))}</ListGroup></> : null}
      {coming.length ? <><SectionTitle title="Coming up" /><ListGroup label="Coming up">{coming.map((c) => row(c, state(c)))}</ListGroup></> : null}
      {played.length ? (
        <><SectionTitle title="Played" /><ListGroup label="Played">
          {played.map((c) => row(c, `${day(c.confirmedAt)}${isRated(c) ? " · counted" : ""}`, <Pill tone={winnerOf(c) === me ? "success" : "neutral"}>{winnerOf(c) === me ? "Won" : "Lost"} {result(c)}</Pill>))}
        </ListGroup></>
      ) : null}
    </PageShell>
  );
}
