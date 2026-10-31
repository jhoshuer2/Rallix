import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "../../lib/auth";

export async function GET(req: Request) {
  await auth().api.signOut({ headers: await headers() });
  return NextResponse.redirect(new URL("/sign-in", req.url));
}
