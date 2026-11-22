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

// ---------------------------------------------------------------------------
// Push notifications (arrive even when the website is closed).
// Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY on Vercel. On iPhone/iPad they only work
// when the site was added to the Home Screen and opened from that icon.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export type PushState = "on" | "off" | "denied" | "unsupported" | "ios-home-screen" | "not-set-up";

const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** What push can do on this device right now (no prompts). */
export async function pushState(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY) return "not-set-up";
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined")
    return isIos() && !isStandalone() ? "ios-home-screen" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const r = await registration();
    const sub = await r?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

/**
 * Turn on push for this device and save it (staff: new orders; customer: their order).
 * Call from a tap. Returns the resulting state.
 */
export async function subscribePush(
  save: (sub: { endpoint: string; p256dh: string; auth: string }) => PromiseLike<{ error: { message: string } | null }>
): Promise<PushState> {
  const state = await pushState();
  if (state === "not-set-up" || state === "unsupported" || state === "ios-home-screen" || state === "denied") return state;
  try {
    if (Notification.permission === "default" && (await Notification.requestPermission()) !== "granted") return "denied";
    const r = await registration();
    if (!r) return "unsupported";
    await navigator.serviceWorker.ready;
    const sub =
      (await r.pushManager.getSubscription()) ??
      (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    const j = sub.toJSON();
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return "off";
    const { error } = await save({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    return error ? "off" : "on";
  } catch {
    return "off";
  }
}

/** Ask the server to push "new" (to staff) or "taken"/"ready" (to the customer). Never throws. */
export function sendPush(orderId: string, event: "new" | "taken" | "ready") {
  try {
    fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, event }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
