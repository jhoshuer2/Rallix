import Link from "next/link";
import { EmptyState, PageShell } from "@rallix/ui";
import { ApplicationSent, ApplyForm } from "../../../../components/ApplyForm";
import { ClubHero, ClubPageSections } from "../../../../components/ClubPageView";
import { myPendingApplications } from "../../../../lib/applications";
import { lookupClubByCode } from "../../../../lib/club-public";
import { getCtx } from "../../../../lib/context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join a club", robots: { index: false, follow: false } };

/** The invite link: read about the club first (rules, schedule, fees), then apply or join. */
export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const club = await lookupClubByCode(code);
  if (!club) return <PageShell title="Invite"><EmptyState title="This link isn’t valid" hint="It may have expired. Ask your club admin for a new invite link." /></PageShell>;
  const ctx = await getCtx();
  const isMember = !!ctx?.clubs.some((c) => c.clubId === club.id);
  const pending = ctx ? (await myPendingApplications(ctx.user.id)).find((a) => a.clubId === club.id) : undefined;
  const open = club.joinMode === "open";
  return (
    <PageShell back={undefined} lead={<ClubHero club={club} />}>
      {isMember ? (
        <a className="rx-btn rx-btn--block" style={{ boxSizing: "border-box" }} href={`/switch/${club.id}`}>You are a member. Open the club</a>
      ) : pending ? (
        <ApplicationSent id={pending.id} clubName={club.name} />
      ) : ctx ? (
        <a className="rx-btn rx-btn--block" style={{ boxSizing: "border-box" }} href="#apply">{open ? "Join this club" : "Apply to join"}</a>
      ) : (
        <Link className="rx-btn rx-btn--block" style={{ boxSizing: "border-box" }} href={`/sign-in?next=${encodeURIComponent(`/join/${code}`)}`}>{open ? "Sign in to join" : "Sign in to apply"}</Link>
      )}
      <ClubPageSections club={club} />
      {ctx && !isMember && !pending ? <ApplyForm code={code} defaultName={ctx.needsName ? "" : ctx.user.name} open={open} /> : null}
    </PageShell>
  );
}
