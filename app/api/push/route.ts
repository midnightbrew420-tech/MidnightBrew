// Sends push notifications that arrive even when the website is closed.
//   POST { orderId, event: "new" }   -> every staff device: "New order: Aung · THR"
//   POST { orderId, event: "taken" } -> the customer's device: "Order accepted"
//   POST { orderId, event: "ready" } -> the customer's device: "Order ready"
// Safe to call from the browser: it only sends when the order really is in that
// state, only once per order and event, and only to devices saved for it.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Event = "new" | "taken" | "ready";
type Sub = { id: string; endpoint: string; p256dh: string; auth: string; lang: string };

const TEXT = {
  en: {
    newTitle: (who: string) => `New order: ${who}`,
    takenTitle: "Your order was accepted",
    takenBody: "We're preparing it now.",
    readyTitle: "Your order is ready",
    readyBody: "Our staff will call your name.",
  },
  th: {
    newTitle: (who: string) => `ออเดอร์ใหม่: ${who}`,
    takenTitle: "รับออเดอร์ของคุณแล้ว",
    takenBody: "กำลังเตรียมให้อยู่นะ",
    readyTitle: "ออเดอร์ของคุณพร้อมแล้ว",
    readyBody: "พนักงานจะเรียกชื่อคุณ",
  },
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !publicKey || !privateKey) return null;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:staff@midnightbrew.app", publicKey, privateKey);
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  const db = config();
  if (!db) return NextResponse.json({ sent: 0, reason: "push not set up" }, { status: 501 });

  let body: { orderId?: string; event?: Event };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { orderId, event } = body;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId) || !["new", "taken", "ready"].includes(event ?? "")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Claim the event for this order (once only), checking the order is really in that state.
  const flag = event === "new" ? "push_new_sent" : event === "taken" ? "push_taken_sent" : "push_ready_sent";
  let claim = db.from("orders").update({ [flag]: true }).eq("id", orderId).eq(flag, false);
  if (event === "new") {
    claim = claim.eq("source", "customer").gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  } else {
    claim = claim.eq("status", event);
  }
  const { data: rows, error: claimErr } = await claim.select(
    "id, order_no, customer_name, location, room, note, order_items(name, qty)"
  );
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  const claimed = rows?.[0];
  if (!claimed) return NextResponse.json({ sent: 0, reason: "nothing to send" });

  // Who gets it, and what it says.
  let subs: Sub[] = [];
  if (event === "new") {
    // Only within opening hours: no staff pushes while the shop is switched to Closed.
    const { data: shop } = await db.from("shop_status").select("is_open").eq("id", 1).maybeSingle();
    if (shop && shop.is_open === false) return NextResponse.json({ sent: 0, reason: "shop closed" });
    const { data } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth, lang").eq("role", "staff");
    subs = (data ?? []) as Sub[];
  } else {
    const { data } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, lang")
      .eq("role", "customer")
      .eq("order_id", orderId);
    subs = (data ?? []) as Sub[];
  }

  const place = placeOf(claimed);
  const who = `${claimed.customer_name}${place ? ` · ${place}` : ""}`;
  const items = ((claimed.order_items ?? []) as { name: string; qty: number }[]).map((i) => `${i.qty}× ${i.name}`).join(", ");

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      const tx = TEXT[s.lang === "th" ? "th" : "en"];
      const payload =
        event === "new"
          ? { title: tx.newTitle(who), body: items || `#${claimed.order_no}`, url: "/staff", tag: `order-${orderId}` }
          : event === "taken"
          ? { title: tx.takenTitle, body: tx.takenBody, url: "/", tag: `mine-${orderId}` }
          : { title: tx.readyTitle, body: tx.readyBody, url: "/", tag: `mine-${orderId}` };
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: event === "new" ? 1800 : 3600, urgency: "high" }
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The device unsubscribed or the address expired: forget it.
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    })
  );
  return NextResponse.json({ sent });
}

// "THR", "MG 204", ... from the order (or from the "[MG 204]" note prefix on older databases).
function placeOf(o: { location?: string | null; room?: string | null; note?: string | null }) {
  if (o.location) return o.room ? `${o.location} ${o.room}` : o.location;
  const m = (o.note ?? "").match(/^\[(THR|EUP|MG|MNB)(?: ([^\]]{1,20}))?\]/);
  return m ? (m[2] ? `${m[1]} ${m[2]}` : m[1]) : "";
}
