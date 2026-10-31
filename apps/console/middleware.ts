import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate on the session cookie; every page and action re-checks the platform_admins list on the server. */
const hasSession = (req: NextRequest) => !!(req.cookies.get("rallix-console.session_token") ?? req.cookies.get("__Secure-rallix-console.session_token"));
const open = [/^\/sign-in/, /^\/api\/auth/, /^\/_next/, /^\/favicon/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (open.some((r) => r.test(pathname)) || hasSession(req)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!.*\\..*).*)"] };
