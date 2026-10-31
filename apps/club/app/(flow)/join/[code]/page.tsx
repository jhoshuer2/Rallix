import { redirect } from "next/navigation";
import { getCtx } from "../../../../lib/context";
import { JoinForm } from "./JoinForm";

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ctx = await getCtx();
  if (!ctx) redirect(`/sign-in?next=${encodeURIComponent(`/join/${code}`)}`);
  return <JoinForm code={code} defaultName={ctx.user.name === "New player" ? "" : ctx.user.name} />;
}
