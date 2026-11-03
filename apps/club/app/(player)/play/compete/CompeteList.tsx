"use client";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, MediaCard, Segmented, SpotsFaces } from "@rallix/ui";

const tabs = ["Active", "Upcoming", "Past"] as const;
type Tab = (typeof tabs)[number];
type Row = { id: string; name: string; level: string | null; tab: Tab; dates: string; cover: string | null; registered: boolean; waiting: boolean; open: boolean; spots: string | null; left: string | null; faces: Array<{ id: string; name: string; photo: string | null }> };

export function CompeteList({ rows }: { rows: Row[] }) {
  const [tab, setTab] = useState<Tab>("Active");
  const shown = rows.filter((c) => c.tab === tab);
  return (
    <>
      <Segmented label="Competition status" value={tab} onChange={setTab} options={tabs.map((t) => ({ value: t, label: t }))} />
      <div style={{ height: 16 }} />
      {shown.length === 0 ? <EmptyState compact title={`No ${tab.toLowerCase()} competitions`} hint="When your club opens a competition, you can join it here." /> : (
        <div className="rx-cstack">
          {shown.map((c) => <MediaCard key={c.id} name={c.name} cover={c.cover} detail={c.spots ? `${c.spots} · ${c.dates}` : c.level ? `${c.level} · ${c.dates}` : c.dates} tag={c.registered ? "Registered" : c.waiting ? "Waitlist" : c.open ? "Open" : c.tab} href={`/play/compete/${c.id}`} linkAs={Link} className="rx-ccard--wide" foot={c.open ? <SpotsFaces left={c.left} faces={c.faces} /> : undefined} />)}
        </div>
      )}
    </>
  );
}
