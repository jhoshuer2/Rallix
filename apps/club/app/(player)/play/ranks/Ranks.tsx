"use client";
import { useState } from "react";
import { ListGroup, ListRow, Photo, Pill, Segmented } from "@rallix/ui";

type R = { id: string; name: string; rank: number; points: number; photo: string | null };

export function Ranks({ clubName, club, global, meId, meUserId }: { clubName: string; club: R[]; global: R[]; meId: string; meUserId: string }) {
  const [scope, setScope] = useState<"club" | "global">("club");
  const rows = scope === "club" ? club : global;
  return (
    <>
      <Segmented label="Leaderboard" value={scope} onChange={setScope} options={[{ value: "club", label: clubName }, { value: "global", label: "Global" }]} />
      {rows.length === 0 ? <p className="rx-muted" style={{ marginTop: 16 }}>No rated players yet.</p> : (
        <ListGroup label={scope === "club" ? "Club leaderboard" : "Global leaderboard"}>
          {rows.map((p) => {
            const you = scope === "club" ? p.id === meId : p.id === meUserId;
            return <ListRow key={p.id} media={<Photo src={p.photo} name={p.name} alt="" />} title={p.name} subtitle={`Rating ${p.points}`} current={you} trailing={<>{you ? <Pill tone="success">You</Pill> : null} <span>#{p.rank}</span></>} />;
          })}
        </ListGroup>
      )}
    </>
  );
}
