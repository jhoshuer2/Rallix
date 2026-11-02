import sharp from "sharp";
import { LIMITS, SPECS, type PhotoKind } from "./kinds";

export class MediaError extends Error {
  constructor(message: string, readonly code: "too_large" | "not_an_image" | "unsupported" | "too_small" | "config" | "storage" = "not_an_image") {
    super(message);
    this.name = "MediaError";
  }
}

/** Only these are accepted. SVG (can carry script), GIF (animation), HEIC and anything else are refused. */
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export type Processed = { bytes: Buffer; contentType: "image/webp"; width: number; height: number };

/**
 * Turns whatever was uploaded into one safe, small WebP:
 * decoded for real (a renamed text file fails), metadata dropped (GPS and camera info), rotated upright, cropped to the target shape.
 * Throws MediaError with a message that is safe to show to the person.
 */
export async function processImage(input: Buffer | Uint8Array, kind: PhotoKind): Promise<Processed> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length === 0) throw new MediaError("That file is empty. Please choose a picture.");
  if (buf.length > LIMITS.maxBytes) throw new MediaError("That picture is too large. Please choose one under 4 MB.", "too_large");
  const spec = SPECS[kind];
  try {
    const img = sharp(buf, { limitInputPixels: LIMITS.maxInputPixels, failOn: "error", animated: false });
    const meta = await img.metadata();
    if (!meta.format || !ALLOWED.has(meta.format)) throw new MediaError("Please use a JPEG, PNG or WebP picture.", "unsupported");
    if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < LIMITS.minEdge) throw new MediaError("That picture is too small. Please use one at least 64 pixels wide.", "too_small");
    const out = await img
      .rotate() // honour the camera's orientation before the metadata is dropped
      .resize(spec.width, spec.height, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    // sharp strips metadata unless withMetadata() is called; assert it so a future change cannot leak GPS data silently.
    const check = await sharp(out.data).metadata();
    if (check.exif || check.icc || check.xmp || check.iptc) throw new MediaError("We couldn’t clean that picture. Please try another.", "not_an_image");
    return { bytes: out.data, contentType: "image/webp", width: out.info.width, height: out.info.height };
  } catch (e) {
    if (e instanceof MediaError) throw e;
    const msg = String((e as Error)?.message ?? "");
    if (/pixel limit|exceeds/i.test(msg)) throw new MediaError("That picture is too large. Please choose a smaller one.", "too_large");
    throw new MediaError("We couldn’t read that file as a picture. Please choose a JPEG, PNG or WebP.");
  }
}
