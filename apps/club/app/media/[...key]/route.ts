import { appEnv, isProduction } from "@rallix/config/env";
import { localStore } from "../../../lib/media";

export const dynamic = "force-dynamic";

/** Development and test only: serves pictures from the local folder. In production pictures come straight from the bucket, so this returns 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (isProduction()) return new Response("Not found", { status: 404 });
  const local = localStore();
  if (!local) return new Response("Not found", { status: 404 });
  const { key } = await params;
  const bytes = await local.read(key.join("/"));
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" } });
}
