import Link from "next/link";
import { Avatar, Card, Chip, ClubRow, SectionHeader } from "@rallix/ui";
import { me, myClubs } from "../../../../lib/mock";

export default function Me() {
  return (
    <>
      <h1 className="rx-title" style={{ marginBottom: 16 }}>Me</h1>
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar src={me.photo} name={me.name} large />
          <div><strong>{me.name}</strong><br /><span>{me.country} · {me.age} yrs · {me.height}</span><br /><Chip tone="warn">{me.level}</Chip></div>
        </div>
      </Card>
      <SectionHeader title="Payments" />
      <Link className="rx-btn rx-btn--ghost rx-btn--block" href="/play/me/payments">Dues, receipts and history</Link>
      <SectionHeader title="My clubs" />
      {myClubs.map((c) => <ClubRow key={c.id} name={c.name} logo={c.logo} role={c.role} href={c.href} current={c.id === "lagos"} linkAs={Link} />)}
      <p className="rx-muted" style={{ fontSize: 13 }}>Your stats and payments are kept separately for each club.</p>
    </>
  );
}
