"use client";
import { useEffect, useState } from "react";
import { getMatchContext, type MatchContext } from "../../lib/offline-store";
import { ScoreSheet } from "../(flow)/competition/[id]/score/ScoreSheet";

export function OfflineScore() {
  const [ctx, setCtx] = useState<MatchContext | null | undefined>(undefined);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("match") ?? "";
    void getMatchContext(id).then((c) => setCtx(c ?? null));
  }, []);
  if (ctx === undefined) return <p role="status">Opening…</p>;
  if (!ctx) return <p>This match is not saved on this phone. Open it once with a signal and it will work without one.</p>;
  return <ScoreSheet competitionId={ctx.competitionId} clubId={ctx.clubId} matchId={ctx.matchId} bestOf={ctx.bestOf} p1={ctx.p1} p2={ctx.p2} />;
}
