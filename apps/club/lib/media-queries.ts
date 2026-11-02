import { cache } from "react";
import { eq } from "drizzle-orm";
import { playerProfiles } from "@rallix/db";
import { inClub, requireClub } from "./context";

/** The signed-in person's picture in the active club (per-club), for the header avatar. */
export const myPhoto = cache(async (): Promise<string | null> => {
  const ctx = await requireClub();
  const [r] = await inClub(ctx, (tx) => tx.select({ url: playerProfiles.photoUrl }).from(playerProfiles).where(eq(playerProfiles.membershipId, ctx.club.membershipId)));
  return r?.url ?? null;
});
