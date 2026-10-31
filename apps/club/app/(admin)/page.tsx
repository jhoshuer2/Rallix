import Link from "next/link";
import { Button, Card, Chip, SectionHeader, StatGrid, Title } from "@rallix/ui";
import { ClubHeader } from "../../components/Header";
import { competitions, payments, players } from "../../lib/mock";

export default function Home() {
  const pending = payments.filter((p) => p.status === "pending" || p.status === "failed").length;
  const active = competitions[0]!;
  return (
    <>
      <ClubHeader />
      <Title>Home</Title>
      <SectionHeader title="This month" />
      <StatGrid stats={[
        { label: "Members", value: String(players.length) },
        { label: "Pending dues", value: String(pending) },
        { label: "Revenue", value: "₦0" },
        { label: "Competitions", value: String(competitions.length) },
      ]} />
      <SectionHeader title="Latest competition" linkLabel="View all" href="/competition" linkAs={Link} />
      <Card variant="outline">
        <Chip tone="active">{active.status}</Chip> <Chip tone="dark">{active.level}</Chip>
        <p className="rx-title" style={{ fontSize: 20, margin: "12px 0" }}>{active.title}</p>
        <Link className="rx-btn" href="/competition/demo/groups">Resume <span className="rx-btn__ball" aria-hidden="true" /></Link>
      </Card>
      <SectionHeader title="Quick actions" />
      <div style={{ display: "grid", gap: 12 }}>
        <Link className="rx-btn rx-btn--ghost rx-btn--block" href="/competition/new">New competition</Link>
        <Link className="rx-btn rx-btn--ghost rx-btn--block" href="/profile">Invite players</Link>
      </div>
      <span hidden><Button>unused</Button></span>
    </>
  );
}
