import { requireClub } from "../lib/context";
import { ClubSwitcher } from "./ClubSwitcher";

export async function ClubHeader() {
  const ctx = await requireClub();
  return <ClubSwitcher blocked={ctx.blocked} user={{ name: ctx.user.name, image: ctx.user.image }} current={ctx.club.clubId}
    clubs={ctx.clubs.map((c) => ({ id: c.clubId, name: c.name, logo: c.logoUrl, role: c.roles.includes("admin") ? "Admin" : c.roles.includes("scorer") ? "Scorer" : c.roles.includes("coach") ? "Coach" : "Player" }))} />;
}
