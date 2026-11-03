"use server";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { clubPages, users, withTenant } from "@rallix/db";
import { CLUB_COOKIE, getCtx, inClub, can, requireClub } from "./context";
import { appDb } from "./db";
import { savePhone } from "./contact";
import { lookupClubByCode } from "./club-public";
import { notifyAdminsOfApplication, notifyApplicant } from "./application-mail";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const LEVELS = ["junior", "intermediate", "senior"] as const;

/**
 * Apply to join the club behind an invite link. In a club that reviews applications this records the application and tells its admins;
 * in an open club it joins straight away. The rules (valid invite, one pending application, daily limit) run in Postgres.
 */
export async function applyToClub(input: { code: string; yourName: string; level: (typeof LEVELS)[number]; phone?: string; message?: string }): Promise<Result<{ outcome: "applied" | "pending" | "joined" | "member" }>> {
  const ctx = await getCtx();
  if (!ctx) return fail("Please sign in again.");
  const name = (input?.yourName ?? "").trim();
  if (name.length < 2) return fail("Enter your name.");
  if (!LEVELS.includes(input.level)) return fail("Choose your level.");
  const club = await lookupClubByCode(input.code);
  if (!club) return fail("This invite link is invalid, expired or full. Ask your club admin for a new one.");
  const phoneProblem = await savePhone(ctx.user.id, input.phone);
  if (phoneProblem) return fail(phoneProblem);
  const message = (input.message ?? "").trim().slice(0, 500);
  const code = await withTenant(appDb(), { userId: ctx.user.id }, async (tx) => {
    await tx.update(users).set({ name }).where(eq(users.id, ctx.user.id));
    const r = await tx.execute(sql`select app.apply_to_club(${input.code}, ${name}, ${input.level}::player_level, ${message}) as r`);
    return (r.rows[0] as { r: string }).r;
  });
  if (code === "invalid") return fail("This invite link is invalid, expired or full. Ask your club admin for a new one.");
  if (code === "blocked") return fail("You can't join this club right now. Please contact the club.");
  if (code === "limit") return fail("You have sent several applications today. Please try again tomorrow.");
  if (code === "joined" || code === "member") {
    (await cookies()).set(CLUB_COOKIE, club.id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/", "layout");
    return { ok: true, outcome: code };
  }
  if (code === "applied") {
    const [row] = (await withTenant(appDb(), { userId: ctx.user.id }, (tx) => tx.execute(sql`select id from membership_applications where user_id = ${ctx.user.id} and club_id = ${club.id} and status = 'pending' order by created_at desc limit 1`))).rows as Array<{ id: string }>;
    if (row) void notifyAdminsOfApplication(row.id);
  }
  return { ok: true, outcome: code === "applied" ? "applied" : "pending" };
}

export async function withdrawApplication(id: string): Promise<Result> {
  const ctx = await getCtx();
  if (!ctx) return fail("Please sign in again.");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Something went wrong. Please try again.");
  const r = await withTenant(appDb(), { userId: ctx.user.id }, (tx) => tx.execute(sql`select app.withdraw_application(${id}) as r`));
  revalidatePath("/", "layout");
  return (r.rows[0] as { r: string }).r === "withdrawn" ? { ok: true } : fail("That application is no longer pending.");
}

/** An admin approves or declines. Approval creates the member; the applicant is emailed the decision. */
export async function decideApplication(id: string, approve: boolean, note?: string): Promise<Result<{ decision: "approved" | "declined" }>> {
  const ctx = await requireClub();
  if (!can(ctx.club, "members")) return fail("Only club admins can review applications.");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Something went wrong. Please try again.");
  const r = await inClub(ctx, (tx) => tx.execute(sql`select app.decide_application(${id}, ${!!approve}, ${(note ?? "").trim().slice(0, 300)}) as r`));
  const code = (r.rows[0] as { r: string }).r;
  if (code !== "approved" && code !== "declined") return fail("This application was already decided.");
  void notifyApplicant(id);
  revalidatePath("/", "layout");
  return { ok: true, decision: code };
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Admins write what people see before they join. Length limits are also enforced by the database. */
export async function saveClubPage(input: { about: string; schedule: string; dressCode: string; equipment: string; rules: string; contact: string; joinMode: "review" | "open"; published: boolean }): Promise<Result> {
  const ctx = await requireClub();
  if (!can(ctx.club, "members")) return fail("Only club admins can edit the club page.");
  const v = { about: clip(input.about, 1000), schedule: clip(input.schedule, 2000), dressCode: clip(input.dressCode, 1000), equipment: clip(input.equipment, 1000), rules: clip(input.rules, 8000), contact: clip(input.contact, 500) };
  const joinMode = input.joinMode === "open" ? "open" : "review";
  const row = { clubId: ctx.club.clubId, about: v.about || null, schedule: v.schedule || null, dressCode: v.dressCode || null, equipment: v.equipment || null, rules: v.rules || null, contact: v.contact || null, joinMode, published: !!input.published, updatedAt: new Date() };
  await inClub(ctx, (tx) => tx.insert(clubPages).values(row).onConflictDoUpdate({ target: clubPages.clubId, set: { ...row } }));
  revalidatePath("/", "layout");
  return { ok: true };
}
