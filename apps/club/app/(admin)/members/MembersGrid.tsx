"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon, MemberCard } from "@rallix/ui";

export type MemberItem = { id: string; name: string; rank: number; rating: number; photo: string | null };

/** Photo grid with a live search box. Filtering is on the client: the list is already loaded and small. */
export function MembersGrid({ members }: { members: MemberItem[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return t ? members.filter((m) => m.name.toLowerCase().includes(t)) : members; }, [members, q]);
  return (
    <>
      <div className="rx-search">
        <Icon name="search" size={20} aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" aria-label="Search members" autoComplete="off" enterKeyHint="search" />
      </div>
      <p className="rx-vh" role="status" aria-live="polite">{q.trim() ? `${shown.length} of ${members.length} members` : ""}</p>
      {shown.length === 0 ? <p className="rx-muted">No one matches “{q.trim()}”.</p> : (
        <div className="rx-mgrid">
          {shown.map((m) => <MemberCard key={m.id} rank={m.rank} name={m.name} rating={m.rating} photo={m.photo} href={`/members/${m.id}`} linkAs={Link} />)}
        </div>
      )}
    </>
  );
}
