import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "../../lib/auth";
import { CLUB_COOKIE } from "../../lib/context";

export async function GET(req: Request) {
  await auth().api.signOut({ headers: await headers() });
  const res = NextResponse.redirect(new URL("/sign-in", req.url));
  res.cookies.delete(CLUB_COOKIE);
  return res;
}
