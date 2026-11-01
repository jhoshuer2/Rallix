import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, HeroMatch, ListGroup, ListRow, PageShell, Pill } from "@rallix/ui";
import { inClub, requireClub } from "../../../../../../../lib/context";
import { listMatches } from "../../../../../../../lib/queries";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MatchDetail({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  if (!uuid.test(id) || !uuid.test(mid)) notFound();
  const ctx = await requireClub();
  const ms = await inClub(ctx, (tx) => listMatches(tx, ctx.club.clubId, { matchId: mid }));
  const m = ms[0];
  if (!m || m.competitionId !== id) notFound();
  const me = ctx.club.membershipId;
  const done = m.status === "completed";
  const a = m.p1 ?? { name: "TBD" }, b = m.p2 ?? { name: "TBD" };
  const playing = m.p1?.id === me || m.p2?.id === me;
  const when = done && m.confirmedAt ? m.confirmedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : m.scheduledAt ? m.scheduledAt.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Date to be confirmed";
  return (
    <PageShell back={<BackButton href={`/play/compete/${id}`} linkAs={Link} />} title={m.round}>
      <HeroMatch competition={m.competitionName} whenLabel={when} startsAt={done || m.status === "live" ? null : m.scheduledAt} live={m.status === "live"} a={a} b={b} scoreA={done || m.status === "live" ? m.gamesP1 : null} scoreB={done || m.status === "live" ? m.gamesP2 : null} />
      {done && playing ? <p style={{ margin: "16px 0 0" }}><Pill tone={m.winnerId === me ? "success" : "neutral"}>{m.winnerId === me ? "You won" : "You lost"}</Pill></p> : null}
      {done ? (
        <ListGroup label="Game scores">
          {m.games.map((g) => <ListRow key={g.no} title={`Game ${g.no}`} trailing={`${g.p1}–${g.p2}`} tone={(g.p1 > g.p2) === (m.p1?.id === me) && playing ? "good" : undefined} />)}
        </ListGroup>
      ) : <p className="rx-muted" style={{ marginTop: 16 }}>Scores appear here once the scorer confirms the result.</p>}
    </PageShell>
  );
}
