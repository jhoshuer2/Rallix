import Link from "next/link";
import { Count, IconButton, RankCard, RankGrid } from "@rallix/ui";
import { players } from "../../../lib/mock";

export default function Members() {
  return (
    <>
      <div className="rx-pagehead__row" style={{ alignItems: "center", marginBottom: 16 }}>
        <h1 className="rx-title">Members <Count>{players.length}</Count></h1>
        <span style={{ display: "flex", gap: 8 }}>
          <IconButton icon="plus" label="Add member" />
          <IconButton icon="search" label="Search members" />
        </span>
      </div>
      <RankGrid>
        {players.map((p) => <RankCard key={p.id} rank={p.rank} name={p.name} points={p.points} photo={p.photo} href={`/members/${p.id}`} linkAs={Link} />)}
      </RankGrid>
    </>
  );
}
