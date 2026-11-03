"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { inClub, requireClub } from "./context";
import { ALL_PERMISSIONS } from "./permissions";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGES: Record<string, string> = { owner: "The club owner is always an admin and always looks after everything.", invalid: "Choose from the responsibilities in the list.", closed: "Only the club owner can change the admin team." };

/** The club owner makes someone an admin, or changes what an admin looks after. The rule runs in Postgres (app.set_admin). */
export async function saveAdmin(memberId: string, permissions: string[]): Promise<Result> {
  const ctx = await requireClub();
  if (!ctx.club.isOwner) return fail(MESSAGES.closed!);
  if (!UUID.test(memberId) || !Array.isArray(permissions) || permissions.some((p) => !(ALL_PERMISSIONS as string[]).includes(p))) return fail(MESSAGES.invalid!);
  const list = [...new Set(permissions)];
  const r = await inClub(ctx, (tx) => tx.execute(sql`select app.set_admin(${memberId}, ${sql.raw(`ARRAY[${list.map((p) => `'${p}'`).join(",")}]::text[]`)}) as r`));
  const code = (r.rows[0] as { r: string }).r;
  revalidatePath("/", "layout");
  return code === "ok" ? { ok: true } : fail(MESSAGES[code] ?? MESSAGES.closed!);
}

export async function removeAdmin(memberId: string): Promise<Result> {
  const ctx = await requireClub();
  if (!ctx.club.isOwner) return fail(MESSAGES.closed!);
  if (!UUID.test(memberId)) return fail(MESSAGES.invalid!);
  const r = await inClub(ctx, (tx) => tx.execute(sql`select app.remove_admin(${memberId}) as r`));
  const code = (r.rows[0] as { r: string }).r;
  revalidatePath("/", "layout");
  return code === "ok" ? { ok: true } : fail(MESSAGES[code] ?? MESSAGES.closed!);
}
