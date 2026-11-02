import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { LocalStore, MediaError, S3Store, clubOfKey, createStore, isOurKey, objectKey, ownKeyFromUrl, processImage } from "./index";

const CLUB = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const photo = (w = 800, h = 600) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 20, g: 80, b: 200 } } });

describe("processImage", () => {
  it("returns a square WebP of the right size and removes ALL metadata (GPS, camera, orientation)", async () => {
    const withMeta = await photo().withExif({ IFD0: { ImageDescription: "secret place", Make: "Camera Co" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    expect((await sharp(withMeta).metadata()).exif).toBeTruthy(); // the input really carries metadata
    const out = await processImage(withMeta, "person");
    expect(out.contentType).toBe("image/webp");
    expect([out.width, out.height]).toEqual([640, 640]);
    const m = await sharp(out.bytes).metadata();
    expect(m.format).toBe("webp");
    expect(m.exif).toBeUndefined(); expect(m.icc).toBeUndefined(); expect(m.xmp).toBeUndefined(); expect(m.orientation).toBeUndefined();
    expect(out.bytes.toString("latin1")).not.toContain("secret place");
  });
  it("makes logos square and covers 1600x1000", async () => {
    const png = await photo(900, 300).png().toBuffer();
    expect((await processImage(png, "club-logo")).width).toBe(512);
    const c = await processImage(png, "club-cover");
    expect([c.width, c.height]).toEqual([1600, 1000]);
  });
  it("accepts PNG and WebP uploads too", async () => {
    expect((await processImage(await photo().png().toBuffer(), "person")).width).toBe(640);
    expect((await processImage(await photo().webp().toBuffer(), "person")).width).toBe(640);
  });
  it("rejects a text file renamed to .jpg, an empty file and random bytes", async () => {
    await expect(processImage(Buffer.from("hello, I am not a picture"), "person")).rejects.toBeInstanceOf(MediaError);
    await expect(processImage(Buffer.alloc(0), "person")).rejects.toThrow(/empty/);
    await expect(processImage(Buffer.from(Array.from({ length: 5000 }, (_, i) => (i * 37) % 251)), "person")).rejects.toBeInstanceOf(MediaError);
  });
  it("rejects SVG (which can carry script) and GIF", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script><rect width="200" height="200"/></svg>');
    await expect(processImage(svg, "person")).rejects.toThrow(/JPEG, PNG or WebP/);
    const gif = await photo(200, 200).gif().toBuffer();
    await expect(processImage(gif, "person")).rejects.toThrow(/JPEG, PNG or WebP/);
  });
  it("rejects anything over 4 MB, tiny pictures, and decompression bombs", async () => {
    await expect(processImage(Buffer.alloc(4 * 1024 * 1024 + 1, 1), "person")).rejects.toMatchObject({ code: "too_large" });
    await expect(processImage(await photo(32, 32).png().toBuffer(), "person")).rejects.toMatchObject({ code: "too_small" });
    const bomb = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    await expect(processImage(bomb, "person")).rejects.toMatchObject({ code: "too_large" });
  }, 60_000);
  it("never leaks internals in error messages", async () => {
    const e = await processImage(Buffer.from("nope"), "person").catch((x) => x as Error);
    expect((e as Error).message).not.toMatch(/sharp|vips|Input buffer|stack/i);
  });
});

describe("keys", () => {
  it("builds keys from uuids only", () => {
    expect(objectKey(CLUB, "person", ID)).toBe(`clubs/${CLUB}/people/${ID}.webp`);
    expect(objectKey(CLUB, "club-logo", ID)).toBe(`clubs/${CLUB}/logo/${ID}.webp`);
    expect(objectKey(CLUB, "club-cover", ID)).toBe(`clubs/${CLUB}/cover/${ID}.webp`);
    expect(() => objectKey("../etc", "person", ID)).toThrow();
    expect(() => objectKey(CLUB, "person", "x/../y")).toThrow();
    expect(isOurKey(objectKey(CLUB, "person"))).toBe(true);
  });
  it("only recognises URLs inside our own store", () => {
    const base = "https://abc.supabase.co/storage/v1/object/public/rallix-media/";
    const key = objectKey(CLUB, "person", ID);
    expect(ownKeyFromUrl(`${base}${key}`, base)).toBe(key);
    expect(ownKeyFromUrl(`${base}${key}?v=2`, base)).toBe(key);
    expect(ownKeyFromUrl(`https://evil.example/${key}`, base)).toBeNull();
    expect(ownKeyFromUrl(`${base}../secret.webp`, base)).toBeNull();
    expect(ownKeyFromUrl("/players/ade.png", base)).toBeNull();
    expect(ownKeyFromUrl(null, base)).toBeNull();
    expect(clubOfKey(key)).toBe(CLUB);
    expect(clubOfKey("clubs/x/people/y.webp")).toBeNull();
  });
});

describe("LocalStore", () => {
  let dir = "";
  afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });
  it("stores, reads and deletes, and refuses paths that escape the folder", async () => {
    dir = await mkdtemp(join(tmpdir(), "rallix-media-"));
    const store = new LocalStore(dir);
    const key = objectKey(CLUB, "person", ID);
    expect(await store.put(key, Buffer.from("abc"))).toBe(`/media/${key}`);
    expect((await store.read(key))?.toString()).toBe("abc");
    await store.delete(key);
    expect(await store.read(key)).toBeNull();
    expect(store.pathFor("../../etc/passwd")).toBeNull();
    expect(store.pathFor(`clubs/${CLUB}/people/../../../x.webp`)).toBeNull();
    await expect(store.put("../evil", Buffer.from("x"))).rejects.toBeInstanceOf(MediaError);
    expect(await readdir(dir)).toBeTruthy();
  });
});

describe("S3Store (mocked client)", () => {
  const cfg = { endpoint: "https://x.supabase.co/storage/v1/s3", region: "eu-west-1", bucket: "rallix-media", accessKeyId: "AKIA_SECRET_ID", secretAccessKey: "super-secret-key", publicBase: "https://x.supabase.co/storage/v1/object/public/rallix-media/" };
  const key = objectKey(CLUB, "person", ID);
  it("puts with the right bucket, key, type and a long cache lifetime, and returns the public URL", async () => {
    const sent: unknown[] = [];
    const store = new S3Store(cfg, { send: async (c: unknown) => { sent.push(c); return {}; } } as never);
    const url = await store.put(key, Buffer.from("img"), "image/webp");
    expect(url).toBe(`https://x.supabase.co/storage/v1/object/public/rallix-media/${key}`);
    const cmd = sent[0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: "rallix-media", Key: key, ContentType: "image/webp", CacheControl: expect.stringContaining("immutable") });
  });
  it("hides provider errors (and credentials) and never throws on delete", async () => {
    const store = new S3Store(cfg, { send: async () => { throw new Error("AccessDenied for AKIA_SECRET_ID at https://x.supabase.co"); } } as never);
    const e = await store.put(key, Buffer.from("img"), "image/webp").catch((x) => x as Error);
    expect(e).toBeInstanceOf(MediaError);
    expect((e as Error).message).not.toMatch(/AKIA|supabase|AccessDenied/);
    await expect(store.delete(key)).resolves.toBeUndefined();
  });
  it("refuses keys that are not ours", async () => {
    const store = new S3Store(cfg, { send: async () => ({}) } as never);
    await expect(store.put("../../x", Buffer.from("a"), "image/webp")).rejects.toBeInstanceOf(MediaError);
  });
});

describe("createStore", () => {
  it("uses the local folder in development and refuses it in production", () => {
    expect(createStore({ NODE_ENV: "development" }).name).toBe("local");
    expect(() => createStore({ NODE_ENV: "production", STORAGE_PROVIDER: "local" })).toThrow(/not allowed in production/);
  });
  it("production defaults to the bucket and names the missing settings without printing values", () => {
    expect(() => createStore({ NODE_ENV: "production", S3_BUCKET: "b" })).toThrow(/S3_ENDPOINT.*S3_ACCESS_KEY_ID/);
    const ok = createStore({ NODE_ENV: "production", S3_ENDPOINT: "https://e", S3_REGION: "r", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s", MEDIA_PUBLIC_BASE: "https://p/" });
    expect(ok.name).toBe("s3"); expect(ok.publicBase).toBe("https://p");
    expect(() => createStore({ STORAGE_PROVIDER: "ftp" })).toThrow(/Unknown STORAGE_PROVIDER/);
  });
});

import { authorizeTarget } from "./index";
describe("authorizeTarget", () => {
  const player = { roles: ["player"], membershipId: ID };
  const admin = { roles: ["admin", "player"], membershipId: ID };
  const other = "33333333-3333-4333-8333-333333333333";
  it("lets anyone change their own picture, and only their own", () => {
    expect(authorizeTarget(player, { kind: "me" })).toEqual({ kind: "person", membershipId: ID });
    expect(authorizeTarget(player, { kind: "member", membershipId: other })).toHaveProperty("error");
  });
  it("lets only admins change other members' pictures and the club pictures", () => {
    expect(authorizeTarget(admin, { kind: "member", membershipId: other })).toEqual({ kind: "person", membershipId: other });
    expect(authorizeTarget(admin, { kind: "club-logo" })).toEqual({ kind: "club-logo", membershipId: null });
    expect(authorizeTarget(admin, { kind: "club-cover" })).toEqual({ kind: "club-cover", membershipId: null });
    for (const kind of ["club-logo", "club-cover"] as const) expect(authorizeTarget(player, { kind })).toHaveProperty("error");
  });
  it("scorers and coaches are not admins", () => {
    for (const roles of [["scorer"], ["coach"], ["scorer", "player"]]) {
      expect(authorizeTarget({ roles, membershipId: ID }, { kind: "club-cover" })).toHaveProperty("error");
      expect(authorizeTarget({ roles, membershipId: ID }, { kind: "member", membershipId: other })).toHaveProperty("error");
    }
  });
  it("rejects a member id that is not a uuid, and unknown kinds", () => {
    expect(authorizeTarget(admin, { kind: "member", membershipId: "1 or 1=1" })).toHaveProperty("error");
    expect(authorizeTarget(admin, { kind: "everything" } as never)).toHaveProperty("error");
  });
});
