"use client";
// Phone/desktop notifications for the menu and staff pages.
// Works while the page is open (also in a background tab). iPhones only allow
// website notifications for sites added to the home screen.

let reg: ServiceWorkerRegistration | null = null;

async function registration() {
  if (reg) return reg;
  try {
    if ("serviceWorker" in navigator) reg = await navigator.serviceWorker.register("/sw.js");
  } catch {}
  return reg;
}

/** Call from a tap (e.g. Place order). Returns true if notifications are allowed. */
export async function askNotifications(): Promise<boolean> {
  try {
    if (typeof Notification === "undefined") return false;
    registration();
    if (Notification.permission === "default") return (await Notification.requestPermission()) === "granted";
    return Notification.permission === "granted";
  } catch {
    return false;
  }
}

export async function notify(title: string, body: string, tag?: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const opts: NotificationOptions = { body, tag, icon: "/logo.png", requireInteraction: true, data: { url: location.href } };
    const r = await registration();
    if (r) return void (await r.showNotification(title, opts));
    new Notification(title, opts);
  } catch {}
}
