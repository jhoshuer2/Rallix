import { redirect } from "next/navigation";
import { getCtx } from "../../../lib/context";
import { OnboardingForm } from "./OnboardingForm";

export default async function Onboarding() {
  const ctx = await getCtx();
  if (!ctx) redirect("/sign-in?next=/onboarding");
  return <OnboardingForm defaultName={ctx.user.name === "New player" ? "" : ctx.user.name} />;
}
