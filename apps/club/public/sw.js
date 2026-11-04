/* Rallix service worker.
 * Always: lock-screen alerts (push).
 * Only when registered as /sw.js?offline=1 (production builds): offline scoring support. It keeps exactly two things:
 *   1. /_next/static/*   hashed build files (cache-first; a new build has new names, so nothing goes stale)
 *   2. /score-offline    one data-free shell page (network-first, the saved copy is used only when there is no signal)
 * Nothing else is cached or answered here, so the rest of the app is never stale. */
const OFFLINE = new URL(self.location.href).searchParams.get("offline") === "1";
const STATIC = "rallix-static-v1", SHELL = "rallix-shell-v1";
const SHELL_URL = "/score-offline";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("rallix-") && k !== STATIC && k !== SHELL) await caches.delete(k);
  if (!OFFLINE) { await caches.delete(STATIC); await caches.delete(SHELL); } // an older offline copy is removed when caching is off
  await self.clients.claim();
})()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }
  const title = typeof d.title === "string" ? d.title.slice(0, 80) : "Rallix";
  const body = typeof d.body === "string" ? d.body.slice(0, 160) : "";
  // Only same-site paths: a push can never send someone to another website.
  const url = typeof d.url === "string" && d.url.startsWith("/") && !d.url.startsWith("//") ? d.url : "/";
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "rallix-arrival", data: { url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { await c.focus(); if ("navigate" in c) { try { await c.navigate(url); } catch { /* ignore */ } } return; } }
    await self.clients.openWindow(url);
  })());
});

async function trim(cache, max) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
}

if (OFFLINE) {
  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith((async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) { await cache.put(req, res.clone()); void trim(cache, 400); }
        return res;
      })());
      return;
    }

    if (req.mode !== "navigate") return;

    if (url.pathname === SHELL_URL) {
      event.respondWith((async () => {
        const cache = await caches.open(SHELL);
        try {
          const res = await fetch(req);
          if (res.ok) await cache.put(SHELL_URL, res.clone());
          return res;
        } catch (e) {
          const hit = await cache.match(SHELL_URL);
          if (hit) return hit;
          throw e;
        }
      })());
      return;
    }

    // The scoring screen itself needs the server. With no signal, send the scorer to the offline copy of the same match.
    const m = /^\/competition\/[^/]+\/score$/.exec(url.pathname);
    const match = url.searchParams.get("match");
    if (m && match) {
      event.respondWith((async () => {
        try { return await fetch(req); }
        catch (e) {
          const cache = await caches.open(SHELL);
          if (await cache.match(SHELL_URL)) return Response.redirect(`${SHELL_URL}?match=${encodeURIComponent(match)}`, 302);
          throw e;
        }
      })());
    }
  });

  /* The scoring screen asks for the offline shell to be saved while there is a signal. */
  self.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "prepare-offline") return;
    event.waitUntil((async () => {
      try {
        const res = await fetch(SHELL_URL, { cache: "reload" });
        if (!res.ok) return;
        const html = await res.clone().text();
        const shell = await caches.open(SHELL);
        await shell.put(SHELL_URL, res);
        const found = new Set();
        for (const x of html.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) found.add(x[0]);
        for (const x of html.matchAll(/static\/(?:chunks|css)\/[^"'\s\\)<>]+\.(?:js|css)/g)) found.add("/_next/" + x[0]);
        const stat = await caches.open(STATIC);
        for (const u of found) {
          if (await stat.match(u)) continue;
          try { const r = await fetch(u); if (r.ok) { await stat.put(u, r.clone()); if (u.endsWith(".css")) for (const f of (await r.text()).matchAll(/url\((\/_next\/static\/[^)"']+)\)/g)) { if (!(await stat.match(f[1]))) { const fr = await fetch(f[1]); if (fr.ok) await stat.put(f[1], fr); } } } } catch { /* one missing file is not fatal */ }
        }
      } catch { /* offline right now: try again next time the screen opens */ }
    })());
  });
}
