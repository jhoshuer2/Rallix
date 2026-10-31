import Link from "next/link";
import { Chip, DueCard, MatchCard, SectionHeader, StatGrid } from "@rallix/ui";
import { ClubHeader } from "../../../components/ClubHeader";
import { PayButton } from "../../../components/PayButton";
import { due, me, myComps, myMatches, oppName, oppPhoto } from "../../../lib/mock";

export default function PlayerHome() {
  const next = myMatches.find((m) => !m.result)!;
  return (
    <>
      <ClubHeader as="player" currentClub="lagos" />
      <h1 className="rx-title">Hi, {me.name}</h1>
      <SectionHeader title="Next match" />
      <MatchCard title={next.comp} when={next.when} opponent={oppName(next.oppId)} opponentPhoto={oppPhoto(next.oppId)} href="/play/compete/demo" linkAs={Link} />
      <SectionHeader title="Dues" />
      <DueCard plan={due.plan} amount={due.amount} due={due.due} status={due.status} action={<PayButton amount={due.amount} />} />
      <SectionHeader title="My standing" linkLabel="Stats" href="/play/stats" linkAs={Link} />
      <StatGrid stats={[{ label: "Club rank", value: String(me.rank) }, { label: "Win rate", value: "47%" }, { label: "Elo", value: "1186" }, { label: "Streak", value: "2 wins" }]} />
      <SectionHeader title="My competitions" linkLabel="View all" href="/play/compete" linkAs={Link} />
      {myComps.filter((c) => c.status === "Active").map((c) => (
        <Link key={c.id} href={`/play/compete/${c.id === "demo2" ? "demo" : c.id}`} className="rx-card" style={{ display: "block", color: "var(--rx-ink)", textDecoration: "none", marginBottom: 8 }}>
          <Chip tone="active">{c.status}</Chip> <Chip tone="warn">{c.level}</Chip>
          <p className="rx-title" style={{ fontSize: 14, margin: "12px 0 0" }}>{c.title}</p>
          <p style={{ fontSize: 12, margin: "4px 0 0" }}>{c.dates}</p>
        </Link>
      ))}
    </>
  );
}
