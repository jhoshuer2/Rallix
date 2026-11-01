import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users } from "@rallix/db";
import { serviceDb } from "../../../../lib/db";
import { appUrl } from "../../../../lib/payments";
import { userFromToken } from "../../../../lib/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (RFC 8058): Gmail, Outlook and Apple Mail POST here from their own Unsubscribe button.
 * It acts only on POST, never GET, so link-scanning software that merely fetches URLs can't unsubscribe anyone.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = userFromToken(token);
  if (!userId) return NextResponse.json({ ok: false }, { status: 400 });
  await serviceDb().update(users).set({ emailOptOut: true }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}

/** A person who opens this URL in a browser is sent to the confirmation page instead. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(`${appUrl()}/unsubscribe/${encodeURIComponent(token)}`, 303);
}
