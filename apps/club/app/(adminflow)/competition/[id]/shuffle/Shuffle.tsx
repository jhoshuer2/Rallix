"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Avatar } from "@rallix/ui";

const spots = [
  { left: "58%", top: "0%", r: "3deg" }, { left: "4%", top: "14%", r: "-4deg" }, { left: "50%", top: "24%", r: "2deg" },
  { left: "10%", top: "58%", r: "-2deg" }, { left: "56%", top: "62%", r: "4deg" }, { left: "6%", top: "84%", r: "-3deg" },
];

export function Shuffle({ id, players }: { id: string; players: Array<{ name: string; photo: string | null }> }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(`/competition/${id}/groups`), 2400);
    return () => clearTimeout(t);
  }, [id, router]);
  return (
    <div className="rx-fullblue"><div className="rx-shuffle" role="status" aria-live="polite">
      {players.map((p, i) => (
        <span key={i} className="rx-shuffle__photo" style={{ left: spots[i]!.left, top: spots[i]!.top, ["--r" as string]: spots[i]!.r, animationDelay: `${i * 90}ms` }}>
          {p.photo ? <img src={p.photo} alt="" style={{ width: "100%", display: "block" }} /> : <Avatar name={p.name} large />}
        </span>
      ))}
      <p className="rx-shuffle__title">Shuffling group</p>
    </div></div>
  );
}
