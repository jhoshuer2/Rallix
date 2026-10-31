import { Suspense } from "react";
import { SelectionForm } from "./SelectionForm";

export default async function Auto({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  return <Suspense><SelectionForm level={level} /></Suspense>;
}
