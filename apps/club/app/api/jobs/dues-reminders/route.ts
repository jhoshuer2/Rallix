import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDueReminders } from "../../../../lib/reminders-core";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const digest = (s: string) => createHash("sha256").update(s).digest();
function authorised(req: Request): boolean | "disabled" {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return "disabled"; // refuse to run unprotected
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  return timingSafeEqual(digest(given), digest(secret)); // hashing first makes the lengths equal, and the compare constant-time
}

/**
 * Daily dues-reminder job. Call it once a day (more often is harmless: every reminder is sent at most once).
 *   curl -X POST https://YOUR-APP/api/jobs/dues-reminders -H "Authorization: Bearer $CRON_SECRET"
 * GET works too because many free cron services can only GET. Optional: ?club=<id>. `?today=YYYY-MM-DD` is ignored in production.
 */
async function handle(req: Request) {
  const ok = authorised(req);
  if (ok === "disabled") return NextResponse.json({ error: "Jobs are disabled: set CRON_SECRET (16+ characters)." }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const url = new URL(req.url);
  const club = url.searchParams.get("club") ?? undefined;
  if (club && !/^[0-9a-f-]{36}$/i.test(club)) return NextResponse.json({ error: "Invalid club" }, { status: 400 });
  try {
    const r = await runDueReminders({ clubId: club, today: url.searchParams.get("today") ?? undefined });
    return NextResponse.json(r, { status: r.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("dues-reminders failed", e);
    return NextResponse.json({ ok: false, error: "The job failed. Check the server log." }, { status: 500 });
  }
}
export const POST = handle;
export const GET = handle;
