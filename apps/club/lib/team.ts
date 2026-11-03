import { and, asc, eq } from "drizzle-orm";
import { clubs, memberships, playerProfiles, users, type Tx } from "@rallix/db";
import { ALL_PERMISSIONS, type Permission } from "./permissions";

export type TeamMember = { id: string; userId: string; name: string; photo: string | null; isOwner: boolean; permissions: Permission[] };

/** The club's admins (owner first) and the members who could become admins. Members may read each other's names and roles, so this runs as the user. */
export async function listTeam(tx: Tx, clubId: string): Promise<{ admins: TeamMember[]; others: TeamMember[] }> {
  const [club] = await tx.select({ ownerId: clubs.ownerId }).from(clubs).where(eq(clubs.id, clubId));
  const rows = await tx.select({ id: memberships.id, userId: memberships.userId, name: users.name, photo: playerProfiles.photoUrl, roles: memberships.roles, permissions: memberships.permissions })
    .from(memberships).innerJoin(users, eq(users.id, memberships.userId)).leftJoin(playerProfiles, eq(playerProfiles.membershipId, memberships.id))
    .where(and(eq(memberships.clubId, clubId), eq(memberships.status, "active"))).orderBy(asc(users.name));
  const all = rows.map<TeamMember & { admin: boolean }>((r) => {
    const isOwner = r.userId === club?.ownerId;
    return { id: r.id, userId: r.userId, name: r.name, photo: r.photo, isOwner, admin: r.roles.includes("admin"), permissions: isOwner ? ALL_PERMISSIONS : r.permissions.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p)) };
  });
  const strip = ({ admin: _a, ...m }: TeamMember & { admin: boolean }): TeamMember => m;
  return { admins: all.filter((m) => m.admin).sort((a, b) => Number(b.isOwner) - Number(a.isOwner)).map(strip), others: all.filter((m) => !m.admin).map(strip) };
}
