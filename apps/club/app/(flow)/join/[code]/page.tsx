import { JoinForm } from "./JoinForm";

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinForm code={code} />;
}
