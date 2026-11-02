import type { PhotoKind } from "./kinds";

/** What a picture is for. `member` lets an admin replace or remove someone else's photo. */
export type Target = { kind: "me" } | { kind: "member"; membershipId: string } | { kind: "club-logo" } | { kind: "club-cover" } | { kind: "competition-cover"; competitionId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who is asking: their role list and their own membership id in the active club. */
export type Actor = { roles: readonly string[]; membershipId: string };

/**
 * The picture kind and the membership it belongs to, or an error message if this person may not touch it.
 * This is the explicit check; the database write that follows runs as the user, so row-level security is a second, independent lock.
 */
export function authorizeTarget(actor: Actor, t: Target): { kind: PhotoKind; membershipId: string | null; competitionId?: string } | { error: string } {
  const admin = actor.roles.includes("admin");
  switch (t.kind) {
    case "me": return { kind: "person", membershipId: actor.membershipId };
    case "member":
      if (!admin) return { error: "Only a club admin can change another member’s photo." };
      if (!UUID.test(t.membershipId)) return { error: "We couldn’t find that member." };
      return { kind: "person", membershipId: t.membershipId };
    case "club-logo": case "club-cover":
      return admin ? { kind: t.kind, membershipId: null } : { error: "Only a club admin can change the club pictures." };
    case "competition-cover":
      if (!admin) return { error: "Only a club admin can change a competition’s picture." };
      if (!UUID.test(t.competitionId)) return { error: "We couldn’t find that competition." };
      return { kind: "competition-cover", membershipId: null, competitionId: t.competitionId };
    default: return { error: "Something went wrong. Please try again." };
  }
}
