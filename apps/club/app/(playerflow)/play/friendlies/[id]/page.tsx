import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, ListGroup, ListRow, Panel, PageShell, Photo, Pill } from "@rallix/ui";
import { isRated, nextStep, winnerOf } from "@rallix/stats";
import { FriendlyActions } from "../../../../../components/FriendlyActions";
import { inClub, requireClub } from "../../../../../lib/context";
import { listMyChallenges } from "../../../../../lib/friendly-queries";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const when = (d: Date | null) => (d ? d.toLocaleString("en-NG", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "No time set");

export default async function FriendlyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const c = (await inClub(ctx, (tx) => listMyChallenges(tx, ctx.club.clubId, me, 200))).find((x) => x.id === id);
  if (!c) notFound();
  const iAmChallenger = c.challengerId === me;
  const other = iAmChallenger ? c.opponent : c.challenger;
  const step = nextStep(c, me);
  const mineGames = iAmChallenger ? c.challengerGames : c.opponentGames, theirGames = iAmChallenger ? c.opponentGames : c.challengerGames;
  const entered = c.enteredBy ? (c.enteredBy === me ? "You" : other.name.split(/\s+/)[0]) : null;
  const w = winnerOf(c);
  const myBefore = iAmChallenger ? c.challengerBefore : c.opponentBefore, myAfter = iAmChallenger ? c.challengerAfter : c.opponentAfter;
  const rated = isRated(c);
  const status = { proposed: "Waiting", accepted: "Accepted", awaiting: "Score entered", confirmed: "Played", declined: "Declined", cancelled: "Called off" }[c.status];
  return (
    <PageShell back={<BackButton href="/play/friendlies" linkAs={Link} />} title={`You vs ${other.name.split(/\s+/)[0]}`}>
      <ListGroup label="Challenge">
        <ListRow media={<Photo src={other.photo} name={other.name} alt="" />} title={other.name} subtitle={iAmChallenger ? "You challenged them" : "Challenged you"} trailing={<Pill tone={c.status === "confirmed" ? "success" : "neutral"}>{status}</Pill>} />
        <ListRow title={when(c.proposedFor)} subtitle={`Best of ${c.bestOf}`} />
        <ListRow title={rated ? "Counts for the ranking" : "Just for fun"} subtitle={!rated && (c.challengerRated || c.opponentRated) && c.status !== "confirmed" ? "It counts only if both of you agree" : undefined} />
      </ListGroup>
      {c.message ? <Panel><p style={{ margin: 0 }}>“{c.message}”</p></Panel> : null}
      {c.status === "confirmed" && mineGames != null && theirGames != null ? (
        <Panel>
          <p className="rx-display" style={{ margin: 0, fontSize: "var(--rx-fs-display)" }}>{mineGames}–{theirGames}</p>
          <p style={{ margin: "4px 0 0" }}>{w === me ? "You won." : "You lost."}{c.ratedAt && myBefore != null && myAfter != null ? ` Rating ${myBefore} → ${myAfter}.` : ""}</p>
        </Panel>
      ) : null}
      {step !== "done" && step !== "closed" ? (
        <Panel>
          <FriendlyActions id={c.id} step={step} otherName={other.name} bestOf={c.bestOf} wantsRated={iAmChallenger ? c.challengerRated : c.opponentRated || c.challengerRated}
            enteredLine={entered && mineGames != null && theirGames != null ? `${entered} entered: you ${mineGames}, ${other.name.split(/\s+/)[0]} ${theirGames}.` : undefined} />
        </Panel>
      ) : null}
    </PageShell>
  );
}
