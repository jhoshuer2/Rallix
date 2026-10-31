"use client";
import Link from "next/link";
import { useState } from "react";
import { AppHeader, ClubRow, Sheet } from "@rallix/ui";
import { admin, club, me, myClubs } from "../lib/mock";

/** Header with the club switcher sheet. `as` decides which person is shown. */
export function ClubHeader({ as = "admin", currentClub = "paris" }: { as?: "admin" | "player"; currentClub?: string }) {
  const [open, setOpen] = useState(false);
  const user = as === "admin" ? admin : { name: me.name, photo: me.photo };
  const cur = myClubs.find((c) => c.id === currentClub) ?? myClubs[0]!;
  return (
    <>
      <AppHeader clubName={cur.name} clubLogo={cur.logo ?? (cur.id === "paris" ? club.logo : undefined)} userName={user.name} userPhoto={user.photo} onClubClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Your clubs">
        {myClubs.map((c) => (
          <span key={c.id} onClick={() => setOpen(false)}>
            <ClubRow name={c.name} logo={c.logo} role={c.role} href={c.href} current={c.id === cur.id} linkAs={Link} />
          </span>
        ))}
      </Sheet>
    </>
  );
}
