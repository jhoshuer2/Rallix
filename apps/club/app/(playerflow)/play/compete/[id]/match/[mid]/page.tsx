import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, Chip, PageHead, PlayerSlot } from "@rallix/ui";
import { inClub, requireClub } from "../../../../../../../lib/context";
import { listMatches, listMembers } from "../../../../../../../lib/queries";
import { slotOf } from "../../../../../../../lib/view";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MatchDetail({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  if (!uuid.test(id) || !uuid.test(mid)) notFound();
  const ctx = await requireClub();
  const d = await inClub(ctx, async (tx) => ({ ms: await listMatches(tx, ctx.club.clubId, { matchId: mid }), members: await listMembers(tx, ctx.club.clubId) }));
  const m = d.ms[0];
  if (!m || m.competitionId !== id) notFound();
  const rank = new Map(d.members.map((x) => [x.id, x.rank]));
  const me = ctx.club.membershipId;
  const done = m.status === "completed";
  const a = slotOf(m, 1, rank), b = slotOf(m, 2, rank);
  return (
    <>
      <PageHead back={<BackButton href={`/play/compete/${id}`} linkAs={Link} />} title={`${m.p1?.name ?? "TBD"} vs ${m.p2?.name ?? "TBD"}`} />
      <p style={{ margin: "0 0 16px" }}>{m.competitionName} · {m.round}</p>
      {done ? (
        <>
          {m.winnerId === me ? <Chip tone="active">You won {m.p1?.id === me ? `${m.gamesP1}–${m.gamesP2}` : `${m.gamesP2}–${m.gamesP1}`}</Chip> : m.p1?.id === me || m.p2?.id === me ? <Chip tone="dark">You lost</Chip> : null}
          <div style={{ height: 16 }} />
          {a ? <PlayerSlot slot={a} /> : null}
          <div style={{ height: 4 }} />
          {b ? <PlayerSlot slot={b} /> : null}
          <table className="rx-sr-only"><caption>Game scores</caption><thead><tr><th>Game</th><th>{m.p1?.name}</th><th>{m.p2?.name}</th></tr></thead>
            <tbody>{m.games.map((g) => <tr key={g.no}><td>{g.no}</td><td>{g.p1}</td><td>{g.p2}</td></tr>)}</tbody></table>
        </>
      ) : <p>This match hasn’t been played yet. Scores appear here once the scorer confirms the result.</p>}
    </>
  );
}
