import Link from "next/link";
import { BackButton, EmptyState, ListGroup, ListRow, PageShell, Photo, SectionTitle } from "@rallix/ui";
import { celebrations, type Celebration } from "@rallix/stats";
import { inClub, requireClub } from "../../../../lib/context";
import { todayInClub } from "../../../../lib/highlights";
import { clubForCelebration, listCelebrants } from "../../../../lib/birthday-queries";

export const dynamic = "force-dynamic";
const CAP = 200;

/** Everyone behind the Club updates strip: birthdays, anniversaries and new members. A plain list, so it stays usable at any club size. */
export default async function Updates() {
  const ctx = await requireClub();
  const { members, club } = await inClub(ctx, async (tx) => ({ members: await listCelebrants(tx, ctx.club.clubId), club: await clubForCelebration(tx, ctx.club.clubId) }));
  const all = celebrations(members, todayInClub(), 7, club ?? undefined);
  const shown = all.slice(0, CAP);
  const groups: Array<[string, Celebration[]]> = [
    ["Today", shown.filter((c) => c.offsetDays === 0)],
    ["Coming up", shown.filter((c) => c.offsetDays > 0)],
    ["Recently", shown.filter((c) => c.offsetDays < 0)],
  ];
  return (
    <PageShell back={<BackButton href="/play" linkAs={Link} />} title="Club updates">
      {shown.length === 0 ? <EmptyState compact title="Nothing yet" hint="Birthdays, anniversaries and new members show up here." /> : groups.filter(([, list]) => list.length).map(([title, list]) => (
        <div key={title}>
          <SectionTitle title={`${title} (${list.length})`} />
          <ListGroup label={title}>
            {list.map((c) => <ListRow key={c.id} media={<Photo src={c.photo} name={c.name} alt="" />} title={c.name} subtitle={c.label} />)}
          </ListGroup>
        </div>
      ))}
      {all.length > CAP ? <p className="rx-muted" style={{ textAlign: "center" }}>Showing the first {CAP} of {all.length}.</p> : null}
    </PageShell>
  );
}
