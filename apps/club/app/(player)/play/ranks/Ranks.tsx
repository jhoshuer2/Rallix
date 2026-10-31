"use client";
import { useState } from "react";
import { RankRow, Segmented } from "@rallix/ui";
import { globalRanks, me, players } from "../../../../lib/mock";

export function Ranks() {
  const [scope, setScope] = useState<"club" | "global">("club");
  return (
    <>
      <Segmented label="Leaderboard" value={scope} onChange={setScope} options={[{ value: "club", label: "Paris Arena" }, { value: "global", label: "Global" }]} />
      <p className="rx-muted" style={{ fontSize: 13 }}>{scope === "club" ? "Ranking within your club." : "Ranking across all clubs on Rallix. Ratings are kept separate per scope."}</p>
      <ul className="rx-pays">
        {scope === "club"
          ? players.map((p) => <RankRow key={p.id} rank={p.rank} name={p.name} photo={p.photo} points={p.points} you={p.id === me.id} />)
          : globalRanks.map((g, i) => <RankRow key={g.id} rank={i + 1} name={g.name} photo={g.photo || undefined} points={g.points} you={g.name === me.name} />)}
      </ul>
    </>
  );
}
