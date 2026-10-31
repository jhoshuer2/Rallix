import Link from "next/link";
import { Bracket, BackButton, BracketRound, MatchPair, PageHead, type Slot } from "@rallix/ui";
import { players } from "../../../../../lib/mock";

const s = (i: number, extra: Partial<Slot> = {}): Slot => { const p = players[i]!; return { rank: p.rank, name: p.name, photo: p.photo, ...extra }; };

export default async function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHead back={<BackButton href={`/competition/${id}/groups`} linkAs={Link} />} title="Paris Arena round of 4" />
      <Bracket>
        <BracketRound title="Semi-finals">
          <MatchPair a={s(6)} b={s(1)} />
          <MatchPair a={s(3)} b={s(2)} />
        </BracketRound>
        <BracketRound title="Final">
          <MatchPair />
        </BracketRound>
      </Bracket>
      <div style={{ height: 24 }} />
      <Link className="rx-btn rx-btn--block" href={`/competition/${id}/score`}>Start final <span className="rx-btn__ball" aria-hidden="true" /></Link>
    </>
  );
}
