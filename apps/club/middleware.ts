import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate: signed-out visitors go to /sign-in. Real session checks happen on the server (lib/context.ts). */
/** Better Auth's session cookie; production over HTTPS adds the __Secure- prefix. Presence only: the server validates it. */
const hasSession = (req: NextRequest) => !!(req.cookies.get("better-auth.session_token") ?? req.cookies.get("__Secure-better-auth.session_token"));

const open = [/^\/sign-in/, /^\/api\/auth/, /^\/api\/webhooks\//, /^\/welcome/, /^\/kit/, /^\/_next/, /^\/favicon/, /^\/players\//, /^\/club\//];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (open.some((r) => r.test(pathname))) return NextResponse.next();
  if (hasSession(req)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!.*\\..*).*)"] };
