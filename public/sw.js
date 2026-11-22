// Service worker: shows phone notifications for the menu and staff pages, including
// push notifications that arrive while the website is closed. It caches nothing.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// A push from the server: { title, body, url, tag }.
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: e.data ? e.data.text() : "Midnight Brew" };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || "Midnight Brew", {
      body: d.body || "",
      tag: d.tag,
      renotify: !!d.tag,
      icon: "/logo.png",
      badge: "/logo.png",
      requireInteraction: true,
      vibrate: [300, 150, 300],
      data: { url: d.url || "/" },
    })
  );
});

// Tapping a notification opens (or focuses) the right page.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const path = new URL(url).pathname;
      const same = list.find((c) => new URL(c.url).pathname === path && "focus" in c);
      return same ? same.focus() : self.clients.openWindow(url);
    })
  );
});
