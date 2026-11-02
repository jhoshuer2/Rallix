/* Rallix service worker: lock-screen alerts only. It caches nothing, so there is never a stale app. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

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
