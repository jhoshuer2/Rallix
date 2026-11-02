import { randomUUID } from "node:crypto";
import { SPECS, type PhotoKind } from "./kinds";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_RE = new RegExp(`^clubs/(${UUID})/(people|logo|cover)/(${UUID})\\.webp$`, "i");

/** Where an object lives. Never uses a name chosen by the user, so keys cannot collide or traverse. */
export function objectKey(clubId: string, kind: PhotoKind, id: string = randomUUID()): string {
  if (!new RegExp(`^${UUID}$`, "i").test(clubId)) throw new Error("clubId must be a uuid");
  if (!new RegExp(`^${UUID}$`, "i").test(id)) throw new Error("id must be a uuid");
  return `clubs/${clubId}/${SPECS[kind].folder}/${id}.webp`;
}

export function isOurKey(key: string): boolean { return KEY_RE.test(key); }

/**
 * If `url` points at an object in OUR store (under `publicBase`), returns its key. Anything else returns null,
 * so seed data, external links and look-alike hosts are never deleted.
 */
export function ownKeyFromUrl(url: string | null | undefined, publicBase: string): string | null {
  if (!url) return null;
  const base = publicBase.replace(/\/+$/, "") + "/";
  if (!url.startsWith(base)) return null;
  const key = url.slice(base.length).split(/[?#]/)[0]!;
  return isOurKey(key) ? key : null;
}

/** The clubId a key belongs to (used to make sure an admin only deletes inside their own club). */
export function clubOfKey(key: string): string | null { return KEY_RE.exec(key)?.[1]?.toLowerCase() ?? null; }
