import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, ListGroup, ListRow, PageShell, Photo, Pill, SectionTitle } from "@rallix/ui";
import { inClub, requireClub } from "../../../../../lib/context";
import { getCompetition, listMatches } from "../../../../../lib/queries";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (d: Date | null) => (d ? d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }) : "Date to be confirmed");

export default async function CompDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const data = await inClub(ctx, async (tx) => {
    const c = await getCompetition(tx, id);
    if (!c) return null;
    return { c, ms: await listMatches(tx, ctx.club.clubId, { competitionId: id }) };
  });
  if (!data) notFound();
  const mine = data.ms.filter((m) => m.p1?.id === me || m.p2?.id === me);
  const rounds = [...new Set(data.ms.map((m) => m.round))];
  return (
    <PageShell flat back={<BackButton href="/play/compete" linkAs={Link} />} title={data.c.name}>
      {mine.length > 0 ? (
        <>
          <SectionTitle title="My fixtures" />
          <ListGroup label="My fixtures">
            {mine.map((m) => {
              const opp = m.p1?.id === me ? m.p2 : m.p1;
              const done = m.status === "completed";
              const won = m.winnerId === me;
              const score = m.p1?.id === me ? `${m.gamesP1}–${m.gamesP2}` : `${m.gamesP2}–${m.gamesP1}`;
              return <ListRow key={m.id} media={<Photo src={opp?.photo} name={opp?.name ?? "TBD"} alt="" />} title={`vs ${opp?.name ?? "TBD"}`} subtitle={`${m.round} · ${done ? day(m.confirmedAt) : day(m.scheduledAt)}`}
                trailing={done ? `${won ? "Won" : "Lost"} ${score}` : <Pill tone={m.status === "live" ? "live" : "neutral"}>{m.status === "live" ? "Live" : "Upcoming"}</Pill>} tone={done ? (won ? "good" : "bad") : undefined} href={`/play/compete/${id}/match/${m.id}`} linkAs={Link} />;
            })}
          </ListGroup>
        </>
      ) : <p className="rx-muted" style={{ marginTop: 0 }}>You have no fixtures in this competition yet.</p>}
      {rounds.map((round) => (
        <div key={round}>
          <SectionTitle title={round} />
          <ListGroup label={`${round} results`}>
            {data.ms.filter((m) => m.round === round).map((m) => {
              const done = m.status === "completed" || m.status === "walkover";
              return <ListRow key={m.id} media={<Photo src={m.p1?.photo} name={m.p1?.name ?? "TBD"} alt="" />} title={`${m.p1?.name ?? "TBD"} vs ${m.p2?.name ?? "TBD"}`} subtitle={done ? day(m.confirmedAt) : day(m.scheduledAt)}
                trailing={done ? `${m.gamesP1}–${m.gamesP2}` : <Pill tone={m.status === "live" ? "live" : "neutral"}>{m.status === "live" ? "Live" : "Upcoming"}</Pill>} href={`/play/compete/${id}/match/${m.id}`} linkAs={Link} />;
            })}
          </ListGroup>
        </div>
      ))}
    </PageShell>
  );
}
