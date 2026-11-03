import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@rallix/ui";
import { ClubHero, ClubPageSections } from "../../../../components/ClubPageView";
import { lookupClubBySlug } from "../../../../lib/club-public";

export const dynamic = "force-dynamic";

/** The public page of a club that chose to publish it. People still need the club's invite link to apply. */
export default async function PublicClub({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await lookupClubBySlug(slug);
  if (!club) notFound();
  return (
    <PageShell lead={<ClubHero club={club} />}>
      <ClubPageSections club={club} />
      <p className="rx-muted" style={{ textAlign: "center" }}>Want to join? Ask the club for its invite link. Already a member? <Link href="/sign-in" style={{ textDecoration: "underline" }}>Sign in</Link>.</p>
    </PageShell>
  );
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const club = await lookupClubBySlug((await params).slug);
  return club ? { title: club.name, description: club.about?.slice(0, 160) ?? `${club.name} on Rallix` } : { title: "Club" };
}
