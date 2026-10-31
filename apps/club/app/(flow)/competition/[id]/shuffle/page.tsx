"use client";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { players } from "../../../../../lib/mock";

const spots = [
  { left: "58%", top: "0%", r: "3deg" }, { left: "4%", top: "14%", r: "-4deg" }, { left: "50%", top: "24%", r: "2deg" },
  { left: "10%", top: "58%", r: "-2deg" }, { left: "56%", top: "62%", r: "4deg" }, { left: "6%", top: "84%", r: "-3deg" },
];

export default function Shuffle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(`/competition/${id}/groups`), 2400);
    return () => clearTimeout(t);
  }, [id, router]);
  return (
    <div className="rx-shuffle" role="status" aria-live="polite">
      {players.slice(0, 6).map((p, i) => (
        <img key={p.id} className="rx-shuffle__photo" src={p.photo} alt="" style={{ left: spots[i]!.left, top: spots[i]!.top, ["--r" as string]: spots[i]!.r, animationDelay: `${i * 90}ms` }} />
      ))}
      <p className="rx-shuffle__title">Shuffling group</p>
    </div>
  );
}
