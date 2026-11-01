"use client";
import { useState } from "react";
import { AppHeader, ClubRow, Sheet } from "@rallix/ui";

type C = { id: string; name: string; logo: string | null; role: string };

export function ClubSwitcher({ user, clubs, current, blocked }: { user: { name: string; image: string | null }; clubs: C[]; current: string; blocked: Array<{ name: string; status: string }> }) {
  const [open, setOpen] = useState(false);
  const cur = clubs.find((c) => c.id === current) ?? clubs[0]!;
  return (
    <>
      <AppHeader clubName={cur.name} clubLogo={cur.logo ?? undefined} userName={user.name} userPhoto={user.image ?? undefined} onClubClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Your clubs">
        {/* Plain links on purpose: next/link would prefetch /switch and change the active club by itself. */}
        {clubs.map((c) => <ClubRow key={c.id} name={c.name} logo={c.logo ?? undefined} role={c.role} href={`/switch/${c.id}`} current={c.id === cur.id} />)}
        {blocked.length ? (
          <div role="note" style={{ marginTop: 12 }}>
            <p className="rx-label" style={{ marginBottom: 6 }}>Unavailable</p>
            {blocked.map((b) => <p key={b.name} className="rx-muted" style={{ margin: "0 0 6px" }}>{b.name} is {b.status}. Ask your club admin to contact Rallix.</p>)}
          </div>
        ) : null}
        <a className="rx-btn rx-btn--ghost rx-btn--block" style={{ marginTop: 12 }} href="/onboarding">Create another club</a>
      </Sheet>
    </>
  );
}
