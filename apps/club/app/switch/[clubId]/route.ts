import { NextResponse } from "next/server";
import { CLUB_COOKIE, getCtx } from "../../../lib/context";

/** Switch the active club (only to a club the user belongs to), then land on the right home for their role. */
export async function GET(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const ctx = await getCtx();
  const url = new URL(req.url);
  if (!ctx) return NextResponse.redirect(new URL("/sign-in", url));
  const club = ctx.clubs.find((c) => c.clubId === clubId);
  if (!club) return NextResponse.redirect(new URL("/", url));
  const res = NextResponse.redirect(new URL(club.roles.includes("admin") ? "/" : "/play", url));
  res.cookies.set(CLUB_COOKIE, clubId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
