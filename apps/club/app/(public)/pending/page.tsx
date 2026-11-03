import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageShell } from "@rallix/ui";
import { ApplicationSent } from "../../../components/ApplyForm";
import { myPendingApplications } from "../../../lib/applications";
import { getCtx } from "../../../lib/context";

export const dynamic = "force-dynamic";

/** A signed-in person with no club yet whose application is waiting. */
export default async function Pending() {
  const ctx = await getCtx();
  if (!ctx) redirect("/sign-in?next=/pending");
  if (ctx.club) redirect("/");
  const apps = await myPendingApplications(ctx.user.id);
  if (apps.length === 0) redirect("/onboarding");
  return (
    <PageShell title="Waiting for approval">
      {apps.map((a) => <ApplicationSent key={a.id} id={a.id} clubName={a.clubName} />)}
      <p className="rx-muted" style={{ textAlign: "center" }}>Want to run your own club instead? <Link href="/onboarding" style={{ textDecoration: "underline" }}>Create a club</Link>.</p>
    </PageShell>
  );
}
