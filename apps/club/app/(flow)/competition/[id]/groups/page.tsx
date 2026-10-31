import Link from "next/link";
import { BackButton, MatchPair, PageHead, type Slot } from "@rallix/ui";
import { players } from "../../../../../lib/mock";

const slot = (i: number): Slot => { const p = players[i % players.length]!; return { rank: p.rank, name: p.name, photo: p.photo, scores: [0, 0, 0, 0, 0] }; };

export default async function Groups({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pairs: Array<[number, number]> = [[6, 4], [1, 5], [3, 2], [0, 6]];
  return (
    <>
      <PageHead back={<BackButton href="/competition" linkAs={Link} />} title="Paris Arena group stage" />
      {pairs.map(([a, b], i) => (
        <Link key={i} href={`/competition/${id}/score`} style={{ color: "inherit", textDecoration: "none" }} aria-label={`Score ${players[a! % players.length]!.name} versus ${players[b! % players.length]!.name}`}>
          <MatchPair a={slot(a)} b={slot(b)} />
        </Link>
      ))}
      <Link className="rx-btn rx-btn--block" href={`/competition/${id}/bracket`}>Round of 16 <span className="rx-btn__ball" aria-hidden="true" /></Link>
    </>
  );
}
