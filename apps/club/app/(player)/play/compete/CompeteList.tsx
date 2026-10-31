"use client";
import Link from "next/link";
import { useState } from "react";
import { Chip, Segmented } from "@rallix/ui";

const tabs = ["Active", "Upcoming", "Past"] as const;
type Tab = (typeof tabs)[number];
type Row = { id: string; name: string; level: string | null; tab: Tab; dates: string };

export function CompeteList({ rows }: { rows: Row[] }) {
  const [tab, setTab] = useState<Tab>("Active");
  const shown = rows.filter((c) => c.tab === tab);
  return (
    <>
      <Segmented label="Competition status" value={tab} onChange={setTab} options={tabs.map((t) => ({ value: t, label: t }))} />
      <div style={{ height: 16 }} />
      {shown.length === 0 ? <p className="rx-muted">No {tab.toLowerCase()} competitions. Your club admin adds you when one is created.</p> : shown.map((c) => (
        <Link key={c.id} href={`/play/compete/${c.id}`} className="rx-card" style={{ display: "block", color: "var(--rx-ink)", textDecoration: "none", marginBottom: 8 }}>
          <Chip tone={c.tab === "Active" ? "active" : "dark"}>{c.tab}</Chip>{c.level ? <> <Chip tone="warn">{c.level}</Chip></> : null}
          <p className="rx-title" style={{ fontSize: 14, margin: "12px 0 0" }}>{c.name}</p>
          <p style={{ fontSize: 12, margin: "4px 0 0" }}>{c.dates}</p>
        </Link>
      ))}
    </>
  );
}
