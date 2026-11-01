import { notFound } from "next/navigation";
import { Suspense } from "react";
import { inClub, requireRole } from "../../../../../../lib/context";
import { listMembers } from "../../../../../../lib/queries";
import { SelectionForm } from "./SelectionForm";

const levels = ["junior", "intermediate", "senior", "combined"];

export default async function Auto({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  if (!levels.includes(level)) notFound();
  const ctx = await requireRole("admin");
  const all = await inClub(ctx, (tx) => listMembers(tx, ctx.club.clubId));
  const eligible = level === "combined" ? all : all.filter((m) => m.level === level);
  return <Suspense><SelectionForm level={level} members={eligible.map((m) => ({ id: m.id, name: m.name, rank: m.rank, photo: m.photo }))} /></Suspense>;
}
