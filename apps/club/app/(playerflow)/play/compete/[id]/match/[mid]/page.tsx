import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, Chip, PageHead, PlayerSlot } from "@rallix/ui";
import { byId, me, myMatches, oppName } from "../../../../../../../lib/mock";

export default async function MatchDetail({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  const m = myMatches.find((x) => x.id === mid);
  if (!m) notFound();
  const opp = byId(m.oppId)!;
  return (
    <>
      <PageHead back={<BackButton href={`/play/compete/${id}`} linkAs={Link} />} title={`${me.name} vs ${oppName(m.oppId)}`} />
      <p style={{ margin: "0 0 16px" }}>{m.comp} · {m.when}</p>
      {m.result ? (
        <>
          <Chip tone={m.result.won ? "active" : "dark"}>{m.result.won ? "You won" : "You lost"} {m.result.score}</Chip>
          <div style={{ height: 16 }} />
          <PlayerSlot slot={{ rank: me.rank, name: me.name, photo: me.photo, scores: m.result.games.map((g) => g[0]), winner: m.result.won }} />
          <div style={{ height: 4 }} />
          <PlayerSlot slot={{ rank: opp.rank, name: opp.name, photo: opp.photo, scores: m.result.games.map((g) => g[1]), winner: !m.result.won }} />
          <table className="rx-sr-only"><caption>Game scores</caption><thead><tr><th>Game</th><th>{me.name}</th><th>{opp.name}</th></tr></thead>
            <tbody>{m.result.games.map((g, i) => <tr key={i}><td>{i + 1}</td><td>{g[0]}</td><td>{g[1]}</td></tr>)}</tbody></table>
        </>
      ) : <p>This match hasn’t been played yet. Scores appear here once the scorer confirms the result.</p>}
    </>
  );
}
