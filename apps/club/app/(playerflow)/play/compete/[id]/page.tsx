import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton, CompetitionBanner, EmptyState, IconBadge, ListGroup, ListRow, PageShell, Photo, Pill, SectionTitle, SpotsBar, countdown } from "@rallix/ui";
import { registrationState, spotsLabel, spotsLeftLabel, spotsPercent, waitlistPosition } from "@rallix/stats";
import { CompetitionJoin } from "../../../../../components/CompetitionJoin";
import { RulesSheet } from "../../../../../components/RulesSheet";
import { ShareRow } from "../../../../../components/ShareRow";
import { Podium, Standings } from "../../../../../components/CompetitionTables";
import { listAwards, peopleOf, tablesFor } from "../../../../../lib/standings-queries";
import { todayInClub } from "../../../../../lib/highlights";
import { can, inClub, requireClub } from "../../../../../lib/context";
import { getCompetitionPreview, listMatches } from "../../../../../lib/queries";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (d: Date | null) => (d ? d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" }) : "Date to be confirmed");

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const FORMATS: Record<string, string> = { group_stage: "Group stage", one_on_one: "One on one", knockout: "Knockout", round_robin: "Round robin" };

export default async function CompDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const data = await inClub(ctx, async (tx) => {
    const p = await getCompetitionPreview(tx, ctx.club.clubId, id, me);
    if (!p) return null;
    const running = p.c.status === "active" || p.c.status === "completed";
    const ms = running ? await listMatches(tx, ctx.club.clubId, { competitionId: id }) : [];
    return { ...p, ms, awards: await listAwards(tx, id), tables: tablesFor(ms, p.c.format, { win: p.c.pointsWin, loss: p.c.pointsLoss }, peopleOf(ms)) };
  });
  if (!data) notFound();
  const { c, participants, registered, myLevel } = data;
  const position = waitlistPosition(data.waitlist, me);
  const today = todayInClub();
  const state = registrationState({ status: c.status, openRegistration: c.openRegistration, maxPlayers: c.maxPlayers, entries: participants.length, closesOn: c.registrationClosesOn, today, registered, waiting: data.waitlist.some((w) => w.id === me), level: c.level, myLevel });
  const draft = c.status === "draft";
  const startsAt = c.startsOn ? new Date(`${c.startsOn}T00:00:00+01:00`) : null;
  const when = draft || c.status === "active" && startsAt && startsAt.getTime() > Date.now()
    ? (startsAt ? { title: startsAt.getTime() > Date.now() ? `Starts in ${countdown(startsAt)}` : "Starting soon", sub: c.endsOn ? `${nice(c.startsOn!)} – ${nice(c.endsOn)}` : nice(c.startsOn!) } : { title: "Date to be confirmed", sub: "The organiser will set it" })
    : { title: c.status === "completed" ? "Finished" : "In progress", sub: c.startsOn && c.endsOn ? `${nice(c.startsOn)} – ${nice(c.endsOn)}` : "" };
  const percent = spotsPercent(participants.length, c.maxPlayers);
  const mine = data.ms.filter((m) => m.p1?.id === me || m.p2?.id === me);
  const rounds = [...new Set(data.ms.map((m) => m.round))];
  const statusPill = <Pill tone={c.status === "active" ? "live" : draft ? "success" : "neutral"}>{draft ? "Open for sign-up" : c.status === "active" ? "Running" : cap(c.status)}</Pill>;
  return (
    <PageShell back={<BackButton href="/play/compete" linkAs={Link} />} lead={<CompetitionBanner name={c.name} summary={c.summary} cover={c.coverUrl} status={statusPill} />}>
      {state !== "hidden" && (draft || registered) ? <CompetitionJoin id={id} state={state} canLeave={draft} level={c.level ? cap(c.level) : null} spots={draft ? (spotsLeftLabel(participants.length, c.maxPlayers) ?? spotsLabel(participants.length, c.maxPlayers)) : null} position={position} /> : null}
      {can(ctx.club, "competitions") ? <Link className="rx-btn rx-btn--ghost rx-btn--block" style={{ marginTop: 12, boxSizing: "border-box" }} href={`/competition/${id}/groups`}>Manage competition</Link> : null}

      <ListGroup label="Competition details">
        <ListRow media={<IconBadge icon="calendar" />} title={when.title} subtitle={when.sub || undefined} />
        {draft && c.registrationClosesOn ? <ListRow media={<IconBadge icon="bell" />} title={`Sign-up closes ${nice(c.registrationClosesOn)}`} subtitle="Join before then" /> : null}
        <ListRow media={<IconBadge icon="grid" />} title={FORMATS[c.format] ?? c.format} subtitle={c.level ? `${cap(c.level)} players` : "All levels"} />
        {c.prize ? <ListRow media={<IconBadge icon="medal" />} title={c.prize} subtitle="Prize" /> : null}
        <ListRow media={<IconBadge icon="members" />} title={spotsLabel(participants.length, c.maxPlayers)} subtitle={draft ? "Registered so far" : "Players"} />
      </ListGroup>
      {percent !== null && draft ? <SpotsBar percent={percent} /> : null}

      {c.rules ? <RulesSheet rules={c.rules} name={c.name} /> : null}
      {draft || c.status === "active" ? <ShareRow title={c.name} text={`${c.name} at ${ctx.club.name} on Rallix.`} path={`/club/${ctx.club.slug}`} /> : null}

      <SectionTitle title="Players" />
      {participants.length ? (
        <div className="rx-avstack" role="img" aria-label={`${participants.length} registered: ${participants.slice(0, 5).map((p) => p.name).join(", ")}${participants.length > 5 ? " and others" : ""}`}>
          {participants.slice(0, 7).map((p) => <Photo key={p.id} src={p.photo} name={p.name} alt="" />)}
          {participants.length > 7 ? <span className="rx-avstack__more" style={{ width: 40, borderRadius: "50%" }}>+{participants.length - 7}</span> : null}
        </div>
      ) : <EmptyState compact title="No one yet" hint={draft ? "Be the first to join." : "Players will appear here."} />}

      <Podium awards={data.awards} />
      <Standings tables={data.tables} meId={me} />
      {data.ms.length ? (
        <>
          <SectionTitle title="Fixtures and results" />
          {mine.length > 0 ? (
            <ListGroup label="My fixtures">
              {mine.map((m) => {
                const opp = m.p1?.id === me ? m.p2 : m.p1;
                const done = m.status === "completed";
                const won = m.winnerId === me;
                const score = m.p1?.id === me ? `${m.gamesP1}–${m.gamesP2}` : `${m.gamesP2}–${m.gamesP1}`;
                return <ListRow key={m.id} media={<Photo src={opp?.photo} name={opp?.name ?? "TBD"} alt="" />} title={`vs ${opp?.name ?? "TBD"}`} subtitle={`${m.round} · ${done ? day(m.confirmedAt) : day(m.scheduledAt)}`}
                  trailing={done ? `${won ? "Won" : "Lost"} ${score}` : <Pill tone={m.status === "live" ? "live" : "neutral"}>{m.status === "live" ? "Live" : "Upcoming"}</Pill>} tone={done ? (won ? "good" : "bad") : undefined} href={`/play/compete/${id}/match/${m.id}`} linkAs={Link} />;
              })}
            </ListGroup>
          ) : null}
          {rounds.map((round) => (
            <div key={round}>
              <SectionTitle title={round} />
              <ListGroup label={`${round} results`}>
                {data.ms.filter((m) => m.round === round).map((m) => {
                  const done = m.status === "completed" || m.status === "walkover";
                  return <ListRow key={m.id} media={<Photo src={m.p1?.photo} name={m.p1?.name ?? "TBD"} alt="" />} title={`${m.p1?.name ?? "TBD"} vs ${m.p2?.name ?? "TBD"}`} subtitle={done ? day(m.confirmedAt) : day(m.scheduledAt)}
                    trailing={done ? `${m.gamesP1}–${m.gamesP2}` : <Pill tone={m.status === "live" ? "live" : "neutral"}>{m.status === "live" ? "Live" : "Upcoming"}</Pill>} href={`/play/compete/${id}/match/${m.id}`} linkAs={Link} />;
                })}
              </ListGroup>
            </div>
          ))}
        </>
      ) : null}
    </PageShell>
  );
}
