/** Browser-only helpers for location and push. Import from client components only. */
export type Fix = { lat: number; lng: number; accuracy: number };

export function getFix(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This device can’t share its location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? "Location is blocked. Allow it for Rallix in your browser or phone settings, then try again." : e.code === 3 ? "Finding you took too long. Try again outdoors." : "We couldn’t read your location.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function locationGranted(): Promise<boolean> {
  try { return (await navigator.permissions.query({ name: "geolocation" as PermissionName })).state === "granted"; } catch { return false; }
}

export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const toBytes = (b64: string) => { const p = "=".repeat((4 - (b64.length % 4)) % 4); const s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

/** Ask for permission (must run from a tap) and subscribe this device. Returns an error message, or null on success. */
export async function enablePush(vapidKey: string | null, save: (s: { endpoint: string; p256dh: string; auth: string; userAgent: string }) => Promise<{ ok: boolean; error?: string }>): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return isIOS() && !isStandalone() ? "On iPhone, first add Rallix to your Home Screen (Share, then Add to Home Screen), then open it from there." : "This browser can’t show lock-screen alerts.";
  if (!vapidKey) return "Alerts aren’t switched on for this site yet.";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Notifications are blocked. Allow them for Rallix in your phone settings, then try again.";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(vapidKey) }));
  const j = sub.toJSON();
  const r = await save({ endpoint: j.endpoint ?? "", p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "", userAgent: navigator.userAgent });
  return r.ok ? null : (r.error ?? "We couldn’t save this device.");
}
