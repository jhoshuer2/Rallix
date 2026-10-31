"use client";
import Link from "next/link";
import { useState } from "react";
import { Chip, Segmented } from "@rallix/ui";
import { myComps } from "../../../../lib/mock";

const tabs = ["Active", "Upcoming", "Past"] as const;
type Tab = (typeof tabs)[number];

export function CompeteList() {
  const [tab, setTab] = useState<Tab>("Active");
  const rows = myComps.filter((c) => c.status === tab);
  return (
    <>
      <Segmented label="Competition status" value={tab} onChange={setTab} options={tabs.map((t) => ({ value: t, label: t }))} />
      <div style={{ height: 16 }} />
      {rows.length === 0 ? <p className="rx-muted">No {tab.toLowerCase()} competitions. Your club admin will add you when one is created.</p> : rows.map((c) => (
        <Link key={c.id} href={`/play/compete/${c.id === "demo2" ? "demo" : c.id}`} className="rx-card" style={{ display: "block", color: "var(--rx-ink)", textDecoration: "none", marginBottom: 8 }}>
          <Chip tone={c.status === "Active" ? "active" : "dark"}>{c.status}</Chip> <Chip tone="warn">{c.level}</Chip>
          <p className="rx-title" style={{ fontSize: 14, margin: "12px 0 0" }}>{c.title}</p>
          <p style={{ fontSize: 12, margin: "4px 0 0" }}>{c.dates}</p>
        </Link>
      ))}
    </>
  );
}
