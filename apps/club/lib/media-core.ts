import { and, eq, gt, sql } from "drizzle-orm";
import { clubs, competitions, playerProfiles, uploadLog } from "@rallix/db";
import { MediaError, authorizeTarget, clubOfKey, objectKey, ownKeyFromUrl, processImage, type ImageStore, type PhotoKind, type Target } from "@rallix/media";
import { can, inClub, type Ctx, type MyClub } from "./context";
import { serviceDb } from "./db";

export type { Target };
export type MediaResult = { ok: true; url: string | null } | { ok: false; error: string };

type Signed = Ctx & { club: MyClub };
/** Pictures follow the admin's responsibility: club and member pictures need Members, competition covers need Competitions. */
const authorize = (ctx: Signed, t: Target) => {
  const need = t.kind === "competition-cover" ? "competitions" : t.kind === "me" ? null : "members";
  const roles = need && !can(ctx.club, need) ? ctx.club.roles.filter((r) => r !== "admin") : ctx.club.roles;
  return authorizeTarget({ roles, membershipId: ctx.club.membershipId }, t);
};

async function recentUploads(userId: string): Promise<number> {
  const [r] = await serviceDb().select({ n: sql<number>`count(*)::int` }).from(uploadLog).where(and(eq(uploadLog.userId, userId), gt(uploadLog.createdAt, new Date(Date.now() - 86_400_000))));
  return r?.n ?? 0;
}

/** Current stored address for the target, read as the user (row-level security applies). */
async function currentUrl(ctx: Signed, kind: PhotoKind, membershipId: string | null, competitionId?: string): Promise<{ url: string | null; exists: boolean }> {
  const rows = await inClub(ctx, async (tx) => kind === "person"
    ? tx.select({ url: playerProfiles.photoUrl }).from(playerProfiles).where(eq(playerProfiles.membershipId, membershipId!))
    : kind === "competition-cover"
    ? tx.select({ url: competitions.coverUrl }).from(competitions).where(eq(competitions.id, competitionId!))
    : tx.select({ url: kind === "club-logo" ? clubs.logoUrl : clubs.coverUrl }).from(clubs).where(eq(clubs.id, ctx.club.clubId)));
  return { url: rows[0]?.url ?? null, exists: rows.length > 0 };
}

/** Writes the new address as the user, so row-level security is the final gatekeeper (a player cannot write someone else's row). */
async function writeUrl(ctx: Signed, kind: PhotoKind, membershipId: string | null, url: string | null, competitionId?: string): Promise<boolean> {
  return inClub(ctx, async (tx) => {
    if (kind === "competition-cover") {
      const r = await tx.update(competitions).set({ coverUrl: url }).where(eq(competitions.id, competitionId!)).returning({ id: competitions.id });
      return r.length === 1;
    }
    if (kind === "person") {
      const r = await tx.insert(playerProfiles).values({ membershipId: membershipId!, clubId: ctx.club.clubId, photoUrl: url })
        .onConflictDoUpdate({ target: playerProfiles.membershipId, set: { photoUrl: url } }).returning({ id: playerProfiles.membershipId });
      return r.length === 1;
    }
    const patch = kind === "club-logo" ? { logoUrl: url } : { coverUrl: url };
    const r = await tx.update(clubs).set(patch).where(eq(clubs.id, ctx.club.clubId)).returning({ id: clubs.id });
    return r.length === 1;
  });
}

/** Deletes an old object, but only if it is one of ours and belongs to this club. Never throws. */
async function dropOld(store: ImageStore, ctx: Signed, oldUrl: string | null) {
  const key = ownKeyFromUrl(oldUrl, store.publicBase);
  if (key && clubOfKey(key) === ctx.club.clubId.toLowerCase()) await store.delete(key);
}

export async function applyUpload(ctx: Signed, store: ImageStore, t: Target, bytes: Buffer, limit: number): Promise<MediaResult> {
  const a = authorize(ctx, t);
  if ("error" in a) return { ok: false, error: a.error };
  if ((await recentUploads(ctx.user.id)) >= limit) return { ok: false, error: "You’ve uploaded a lot of pictures today. Please try again tomorrow." };
  let processed;
  try { processed = await processImage(bytes, a.kind); } catch (e) { return { ok: false, error: e instanceof MediaError ? e.message : "We couldn’t use that picture." }; }
  const before = await currentUrl(ctx, a.kind, a.membershipId, a.competitionId);
  if (a.kind === "competition-cover" && !before.exists) return { ok: false, error: "We couldn’t find that competition." };
  const key = objectKey(ctx.club.clubId, a.kind);
  let url: string;
  try { url = await store.put(key, processed.bytes, processed.contentType); } catch (e) { return { ok: false, error: e instanceof MediaError ? e.message : "We couldn’t save that picture right now. Please try again." }; }
  let saved = false;
  try { saved = await writeUrl(ctx, a.kind, a.membershipId, url, a.competitionId); } catch { saved = false; }
  if (!saved) { await store.delete(key); return { ok: false, error: "We couldn’t save that picture. You may not have permission to change it." }; }
  await serviceDb().insert(uploadLog).values({ userId: ctx.user.id, clubId: ctx.club.clubId, kind: a.kind, bytes: bytes.length }).catch(() => undefined);
  await dropOld(store, ctx, before.url);
  return { ok: true, url };
}

export async function applyRemove(ctx: Signed, store: ImageStore, t: Target): Promise<MediaResult> {
  const a = authorize(ctx, t);
  if ("error" in a) return { ok: false, error: a.error };
  const before = await currentUrl(ctx, a.kind, a.membershipId, a.competitionId);
  if (!before.exists) return { ok: true, url: null };
  let saved = false;
  try { saved = await writeUrl(ctx, a.kind, a.membershipId, null, a.competitionId); } catch { saved = false; }
  if (!saved) return { ok: false, error: "We couldn’t remove that picture. You may not have permission to change it." };
  await dropOld(store, ctx, before.url);
  return { ok: true, url: null };
}
