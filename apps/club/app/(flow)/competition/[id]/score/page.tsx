import { ScoreSheet } from "./ScoreSheet";

export default async function Score({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScoreSheet id={id} />;
}
