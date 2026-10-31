import Link from "next/link";
import { BackButton, Bracket, BracketRound, MatchCard, MatchPair, PageHead, SectionHeader, type Slot } from "@rallix/ui";
import { byId, myMatches, oppName, oppPhoto } from "../../../../../lib/mock";

const s = (id: string, extra: Partial<Slot> = {}): Slot => { const p = byId(id)!; return { rank: p.rank, name: p.name, photo: p.photo, ...extra }; };

export default async function CompDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHead back={<BackButton href="/play/compete" linkAs={Link} />} title="Paris Arena group stage" />
      <SectionHeader title="My fixtures" />
      {myMatches.filter((m) => m.comp === "Paris Arena Group Stage").map((m) => (
        <MatchCard key={m.id} title={m.comp} when={m.when} opponent={oppName(m.oppId)} opponentPhoto={oppPhoto(m.oppId)}
          result={m.result && { won: m.result.won, score: m.result.score }} href={`/play/compete/${id}/match/${m.id}`} linkAs={Link} />
      ))}
      <SectionHeader title="Bracket" />
      <Bracket>
        <BracketRound title="Semi-finals">
          <MatchPair a={s("ade")} b={s("pastor")} />
          <MatchPair a={s("nurudeen")} b={s("sule")} />
        </BracketRound>
        <BracketRound title="Final"><MatchPair /></BracketRound>
      </Bracket>
    </>
  );
}
