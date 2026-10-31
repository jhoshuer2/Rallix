"use client";
import { useState } from "react";
import { RankRow, Segmented } from "@rallix/ui";

type R = { id: string; name: string; rank: number; points: number; photo: string | null };

export function Ranks({ clubName, club, global, meId, meUserId }: { clubName: string; club: R[]; global: R[]; meId: string; meUserId: string }) {
  const [scope, setScope] = useState<"club" | "global">("club");
  const rows = scope === "club" ? club : global;
  return (
    <>
      <Segmented label="Leaderboard" value={scope} onChange={setScope} options={[{ value: "club", label: clubName }, { value: "global", label: "Global" }]} />
      <p className="rx-muted" style={{ fontSize: 13 }}>{scope === "club" ? "Ranking within your club, by rating." : "Ranking across all clubs on Rallix. Ratings are kept separate per scope."}</p>
      {rows.length === 0 ? <p className="rx-muted">No rated players yet.</p> : (
        <ul className="rx-pays">
          {rows.map((p) => <RankRow key={p.id} rank={p.rank} name={p.name} photo={p.photo ?? undefined} points={p.points} you={scope === "club" ? p.id === meId : p.id === meUserId} />)}
        </ul>
      )}
    </>
  );
}
