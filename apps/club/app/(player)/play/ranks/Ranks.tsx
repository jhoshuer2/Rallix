"use client";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, ListGroup, ListRow, Photo, Pill, Segmented } from "@rallix/ui";

type R = { id: string; name: string; rank: number; points: number; photo: string | null };

export function Ranks({ clubName, club, global, season, meId, meUserId }: { clubName: string; club: R[]; global: R[]; season: { name: string; rows: R[] } | null; meId: string; meUserId: string }) {
  const [scope, setScope] = useState<"club" | "season" | "global">("club");
  const rows = scope === "club" ? club : scope === "season" ? season?.rows ?? [] : global;
  return (
    <>
      <Segmented label="Leaderboard" value={scope} onChange={setScope} options={[{ value: "club", label: clubName }, ...(season ? [{ value: "season" as const, label: season.name }] : []), { value: "global", label: "Global" }]} />
      {rows.length === 0 ? <EmptyState compact title="No rated players yet" hint="Ratings start after the first confirmed match." /> : (
        <ListGroup label={scope === "club" ? "Club leaderboard" : scope === "season" ? "Season table" : "Global leaderboard"}>
          {rows.map((p) => {
            const you = scope === "global" ? p.id === meUserId : p.id === meId;
            return <ListRow key={p.id} media={<Photo src={p.photo} name={p.name} alt="" />} title={p.name} subtitle={scope === "season" ? `${p.points} points` : `Rating ${p.points}`} current={you} href={scope === "club" && !you ? `/play/friendlies/new?to=${p.id}` : undefined} linkAs={Link} ariaLabel={scope === "club" && !you ? `${p.name}, rank ${p.rank}. Challenge to a friendly` : undefined}
              trailing={<>{you ? <Pill tone="success">You</Pill> : null} <span>#{p.rank}</span></>} />;
          })}
        </ListGroup>
      )}
    </>
  );
}
