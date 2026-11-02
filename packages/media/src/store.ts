import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isOurKey } from "./keys";
import { MediaError } from "./process";

/** Where finished pictures go. Two adapters: a local folder (dev, tests) and an S3-compatible bucket (Supabase Storage). */
export interface ImageStore {
  readonly name: "local" | "s3";
  /** Public base URL that keys are appended to. */
  readonly publicBase: string;
  put(key: string, bytes: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}

const CACHE = "public, max-age=31536000, immutable"; // keys are never reused, so a picture can be cached forever

export class LocalStore implements ImageStore {
  readonly name = "local" as const;
  readonly publicBase: string;
  constructor(private readonly dir: string, publicBase = "/media") { this.publicBase = publicBase.replace(/\/+$/, ""); }
  /** Resolves a key to a path inside `dir`, or null if it would escape it. Used by the dev file route as well. */
  pathFor(key: string): string | null {
    if (!isOurKey(key)) return null;
    const root = resolve(this.dir);
    const full = resolve(join(root, normalize(key)));
    return full.startsWith(root + sep) ? full : null;
  }
  async put(key: string, bytes: Buffer): Promise<string> {
    const p = this.pathFor(key);
    if (!p) throw new MediaError("Invalid file location.", "storage");
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, bytes);
    return `${this.publicBase}/${key}`;
  }
  async read(key: string): Promise<Buffer | null> { const p = this.pathFor(key); if (!p) return null; try { return await readFile(p); } catch { return null; } }
  async delete(key: string): Promise<void> { const p = this.pathFor(key); if (p) await rm(p, { force: true }); }
}

export type S3Config = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBase: string };

export class S3Store implements ImageStore {
  readonly name = "s3" as const;
  readonly publicBase: string;
  private readonly client: Pick<S3Client, "send">;
  constructor(private readonly cfg: S3Config, client?: Pick<S3Client, "send">) {
    this.publicBase = cfg.publicBase.replace(/\/+$/, "");
    this.client = client ?? new S3Client({ endpoint: cfg.endpoint, region: cfg.region, forcePathStyle: true, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } });
  }
  async put(key: string, bytes: Buffer, contentType: string): Promise<string> {
    if (!isOurKey(key)) throw new MediaError("Invalid file location.", "storage");
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: CACHE }));
    } catch { throw new MediaError("We couldn’t save that picture right now. Please try again.", "storage"); } // never echo provider errors (they can name hosts and keys)
    return `${this.publicBase}/${key}`;
  }
  async delete(key: string): Promise<void> {
    if (!isOurKey(key)) return;
    try { await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key })); } catch { /* best effort: an orphan file is harmless */ }
  }
}

/** Picks the store from the environment. Production refuses the local folder. */
export function createStore(env: Record<string, string | undefined>, localDir = ".data/media"): ImageStore {
  const provider = env.STORAGE_PROVIDER ?? (env.NODE_ENV === "production" ? "supabase" : "local");
  if (provider === "local") {
    if (env.NODE_ENV === "production") throw new MediaError("Local picture storage is not allowed in production. Set STORAGE_PROVIDER=supabase.", "config");
    return new LocalStore(localDir);
  }
  if (provider !== "supabase" && provider !== "s3") throw new MediaError(`Unknown STORAGE_PROVIDER "${provider}".`, "config");
  const need = ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "MEDIA_PUBLIC_BASE"] as const;
  const missing = need.filter((k) => !env[k]);
  if (missing.length) throw new MediaError(`Picture storage is not configured: set ${missing.join(", ")}.`, "config");
  return new S3Store({ endpoint: env.S3_ENDPOINT!, region: env.S3_REGION!, bucket: env.S3_BUCKET!, accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY!, publicBase: env.MEDIA_PUBLIC_BASE! });
}
