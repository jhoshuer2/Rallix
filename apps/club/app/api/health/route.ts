export const dynamic = "force-dynamic";

/** A liveness check for deploy tooling and CI: no database, no session, no data. */
export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
