import { notFound } from "next/navigation";
import { Suspense } from "react";
import { inClub, requirePermission } from "../../../../../../lib/context";
import { clubRules } from "../../../../../../lib/match-rules";
import { listMembers } from "../../../../../../lib/queries";
import { SelectionForm } from "./SelectionForm";

const levels = ["junior", "intermediate", "senior", "combined"];

export default async function Auto({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  if (!levels.includes(level)) notFound();
  const ctx = await requirePermission("competitions");
  const { all, rules } = await inClub(ctx, async (tx) => ({ all: await listMembers(tx, ctx.club.clubId), rules: await clubRules(tx, ctx.club.clubId) }));
  const eligible = level === "combined" ? all : all.filter((m) => m.level === level);
  return <Suspense><SelectionForm level={level} defaults={{ bestOf: rules.bestOf, points: rules.rules.points, winBy: rules.rules.winBy, cap: rules.rules.cap }} members={eligible.map((m) => ({ id: m.id, name: m.name, rank: m.rank, photo: m.photo }))} /></Suspense>;
}
