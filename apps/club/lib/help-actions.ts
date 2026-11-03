"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { inClub, requireClub } from "./context";

type Result = { ok: true } | { ok: false; error: string };

const WHY: Record<string, string> = {
  invalid: "Give it a short title (3 to 120 characters). The details can be up to 2,000.",
  limit: "You’ve sent five requests today. We’ll get back to you on those first.",
  denied: "You can’t send a request from this club.",
};

/** A request to Rallix support. The club and the sender are filled in by the database, never taken from the form. */
export async function sendHelpRequest(input: { title: string; body: string }): Promise<Result> {
  const ctx = await requireClub();
  const title = String(input?.title ?? ""), body = String(input?.body ?? "");
  const code = await inClub(ctx, async (tx) => String((await tx.execute(sql`select app.report_issue(${title}, ${body}) as r`)).rows[0]?.r));
  if (code !== "sent") return { ok: false, error: WHY[code] ?? "Something went wrong. Please try again." };
  revalidatePath("/profile/help"); revalidatePath("/play/help");
  return { ok: true };
}
