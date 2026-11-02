"use server";
import { revalidatePath } from "next/cache";
import { LIMITS } from "@rallix/media";
import { requireClub } from "./context";
import { store, uploadLimit } from "./media";
import { applyRemove, applyUpload, type MediaResult, type Target } from "./media-core";

function parseTarget(kind: unknown, membershipId: unknown, competitionId?: unknown): Target | null {
  if (kind === "me" || kind === "club-logo" || kind === "club-cover") return { kind };
  if (kind === "member" && typeof membershipId === "string") return { kind, membershipId };
  if (kind === "competition-cover" && typeof competitionId === "string") return { kind, competitionId };
  return null;
}

/** Upload one picture. The form carries `kind`, optional `membershipId`, and `file`. Nothing from the browser is trusted but the bytes, which are re-encoded. */
export async function uploadPhoto(form: FormData): Promise<MediaResult> {
  const ctx = await requireClub();
  const target = parseTarget(form.get("kind"), form.get("membershipId"), form.get("competitionId"));
  const file = form.get("file");
  if (!target) return { ok: false, error: "Something went wrong. Please try again." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Please choose a picture." };
  if (file.size > LIMITS.maxBytes) return { ok: false, error: "That picture is too large. Please choose one under 4 MB." };
  const r = await applyUpload(ctx, store(), target, Buffer.from(await file.arrayBuffer()), uploadLimit());
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function removePhoto(kind: string, membershipId?: string, competitionId?: string): Promise<MediaResult> {
  const ctx = await requireClub();
  const target = parseTarget(kind, membershipId, competitionId);
  if (!target) return { ok: false, error: "Something went wrong. Please try again." };
  const r = await applyRemove(ctx, store(), target);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
