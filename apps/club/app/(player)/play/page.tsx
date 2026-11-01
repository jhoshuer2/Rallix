import Link from "next/link";
import { Chip, DueCard, MatchCard, SectionHeader, StatGrid } from "@rallix/ui";
import { streakLabel } from "@rallix/stats";
import { ClubHeader } from "../../../components/ClubHeader";
import { PayButton } from "../../../components/PayButton";
import { inClub, requireClub } from "../../../lib/context";
import { payoutsEnabled } from "../../../lib/payment-queries";
import { listCompetitions, listDues, listMatches, listMembers, memberStats, naira, fmtDate} from "../../../lib/queries";

export default async function PlayerHome() {
  const ctx = await requireClub();
  const me = ctx.club.membershipId;
  const d = await inClub(ctx, async (tx) => ({
    matches: await listMatches(tx, ctx.club.clubId, { memberId: me }),
    dues: await listDues(tx, ctx.club.clubId, me),
    stats: await memberStats(tx, ctx.club.clubId, me),
    members: await listMembers(tx, ctx.club.clubId),
    comps: await listCompetitions(tx, ctx.club.clubId, me),
  }));
  const payOn = await payoutsEnabled(ctx);
  const next = d.matches.filter((m) => m.status === "scheduled" || m.status === "live").sort((a, b) => (a.scheduledAt?.getTime() ?? Infinity) - (b.scheduledAt?.getTime() ?? Infinity))[0];
  const due = d.dues.find((x) => x.status === "due" || x.status === "overdue");
  const mine = d.members.find((m) => m.id === me);
  const r = d.stats.record;
  const opp = next && (next.p1?.id === me ? next.p2 : next.p1);
  return (
    <>
      <ClubHeader />
      <h1 className="rx-title">Hi, {ctx.user.name.split(" ")[0]}</h1>
      <SectionHeader title="Next match" />
      {next && opp ? (
        <MatchCard title={next.competitionName} when={next.scheduledAt ? next.scheduledAt.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Date to be confirmed"}
          opponent={opp.name} opponentPhoto={opp.photo ?? undefined} href={`/play/compete/${next.competitionId}`} linkAs={Link} />
      ) : <p className="rx-muted">No upcoming matches.</p>}
      <SectionHeader title="Dues" />
      {due ? <DueCard plan={due.plan} amount={naira(due.amountKobo)} due={fmtDate(due.dueDate)} status={due.status === "overdue" ? "overdue" : "due"} action={<PayButton dueId={due.id} amount={naira(due.amountKobo)} enabled={payOn} />} />
        : <p className="rx-muted">{d.dues.length ? "You’re all paid up." : "No dues yet."}</p>}
      <SectionHeader title="My standing" linkLabel="Stats" href="/play/stats" linkAs={Link} />
      <StatGrid stats={[
        { label: "Club rank", value: mine ? String(mine.rank) : "—" },
        { label: "Win rate", value: r.played ? `${r.winPct}%` : "—" },
        { label: "Rating", value: mine ? String(mine.rating) : "—" },
        { label: "Streak", value: streakLabel(r.streak) },
      ]} />
      <SectionHeader title="My competitions" linkLabel="View all" href="/play/compete" linkAs={Link} />
      {d.comps.filter((c) => c.status === "active").map((c) => (
        <Link key={c.id} href={`/play/compete/${c.id}`} className="rx-card" style={{ display: "block", color: "var(--rx-ink)", textDecoration: "none", marginBottom: 8 }}>
          <Chip tone="active">Active</Chip>{c.level ? <> <Chip tone="warn">{c.level}</Chip></> : null}
          <p className="rx-title" style={{ fontSize: 14, margin: "12px 0 0" }}>{c.name}</p>
        </Link>
      ))}
      {d.comps.filter((c) => c.status === "active").length === 0 ? <p className="rx-muted">You’re not in an active competition.</p> : null}
    </>
  );
}
