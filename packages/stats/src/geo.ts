/** Court check-in maths. Pure: no I/O. Distances in metres. */
export type Point = { lat: number; lng: number };
export const MAX_ACCURACY_M = 150;

const rad = (d: number) => (d * Math.PI) / 180;
const valid = (p: Point) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** Great-circle distance (haversine). Handles the antimeridian because it uses the sine of half the longitude gap. */
export function distanceM(a: Point, b: Point): number {
  const R = 6_371_008.8;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type VenueCheck = { ok: true; distanceM: number } | { ok: false; reason: "invalid" | "inaccurate" | "far"; distanceM?: number };

/**
 * Is the reported point at the venue? A fix worse than MAX_ACCURACY_M is refused (it could be anywhere).
 * The reported accuracy is allowed as extra slack, so a good fix right at the edge is not wrongly refused.
 */
export function withinVenue(point: Point, accuracyM: number, venue: Point, radiusM: number): VenueCheck {
  if (!valid(point) || !valid(venue) || !Number.isFinite(accuracyM) || accuracyM < 0 || !(radiusM > 0)) return { ok: false, reason: "invalid" };
  if (accuracyM > MAX_ACCURACY_M) return { ok: false, reason: "inaccurate" };
  const d = distanceM(point, venue);
  return d <= radiusM + accuracyM ? { ok: true, distanceM: Math.round(d) } : { ok: false, reason: "far", distanceM: Math.round(d) };
}

/** Alert others only if this player has not already been announced in the last `hours`. */
export function shouldAlert(lastAlertedAt: Date | null | undefined, now: Date, hours = 2): boolean {
  return !lastAlertedAt || now.getTime() - lastAlertedAt.getTime() >= hours * 3_600_000;
}

/** An arrival with no check-out stops counting as "here now" after `hours`. */
export const isHereNow = (arrivedAt: Date, leftAt: Date | null, now: Date, hours = 6) => !leftAt && now.getTime() - arrivedAt.getTime() < hours * 3_600_000;

/** The lock-screen text for an arrival. Name and club only: nothing about where the person is beyond "at the club". */
export function arrivalMessage(name: string, clubName: string, hereCount: number) {
  const first = name.trim().split(/\s+/)[0] || "A player";
  const n = Math.max(1, Math.floor(hereCount));
  return { title: `${first} just arrived`, body: `${clubName} · ${n} ${n === 1 ? "player" : "players"} here` };
}
