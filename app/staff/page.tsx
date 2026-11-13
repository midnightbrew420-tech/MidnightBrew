"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";
import { MenuItem, Order, sortMenu } from "@/lib/types";
import Active from "@/components/staff/Active";
import AddItems from "@/components/staff/AddItems";
import History from "@/components/staff/History";
import Report from "@/components/staff/Report";
import MenuToggle from "@/components/staff/MenuToggle";
import OrderModal from "@/components/staff/OrderModal";
import QrModal from "@/components/staff/QrModal";
import { audioReady, chime, unlockAudio } from "@/components/staff/alarm";
import { askNotifications, notify } from "@/lib/notify";

type Tab = "active" | "add" | "history" | "report" | "menu";
const TABS: { id: Tab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "add", label: "Add items" },
  { id: "history", label: "Paid / Cancelled" },
  { id: "report", label: "Report" },
  { id: "menu", label: "Menu on/off" },
];

export default function StaffPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    try {
      const db = supabase();
      db.auth.getSession().then(({ data }) => setSession(data.session));
      const { data } = db.auth.onAuthStateChange((_e, s) => setSession(s));
      return () => data.subscription.unsubscribe();
    } catch (e) {
      setConfigError((e as Error).message);
      setSession(null);
    }
  }, []);

  if (configError) return <div className="login card error">{configError}</div>;
  if (session === undefined) return <div className="empty">Loading…</div>;
  if (!session) return <Login />;
  return <Dashboard email={session.user.email ?? ""} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="login card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        unlockAudio(); // the login click counts as the gesture that enables alert sounds
        const { error } = await supabase().auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) setErr(error.message);
      }}
    >
      <div className="brand" style={{ justifyContent: "center", marginBottom: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" />
        <div>
          <h1>{BRAND.name}</h1>
          <div className="tag">Staff</div>
        </div>
      </div>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      {err && <div className="error">{err}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("active");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [active, setActive] = useState<Order[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openSnapshot, setOpenSnapshot] = useState<Order | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [notifPerm, setNotifPerm] = useState<string>("default");
  const [shopOpen, setShopOpen] = useState<boolean | null>(null); // null until loaded
  const [shopBusy, setShopBusy] = useState(false);
  const knownIds = useRef<Set<string> | null>(null);

  const loadMenu = useCallback(async () => {
    const { data } = await supabase().from("menu_items").select("*");
    if (data) setMenu(sortMenu(data as MenuItem[]));
  }, []);

  const loadActive = useCallback(async () => {
    const { data } = await supabase()
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ["new", "taken", "ready"])
      .order("created_at", { ascending: true });
    if (!data) return;
    const list = data as Order[];
    // System notification for orders we haven't seen before
    if (knownIds.current) {
      for (const o of list) {
        if (o.status === "new" && !knownIds.current.has(o.id)) notifyNewOrder(o);
      }
    }
    knownIds.current = new Set(list.map((o) => o.id));
    setActive(list);
  }, []);

  const loadShop = useCallback(async () => {
    const { data } = await supabase().from("shop_status").select("is_open").eq("id", 1).maybeSingle();
    if (data) setShopOpen(data.is_open !== false);
  }, []);

  const toggleShop = async () => {
    if (shopOpen === null || shopBusy) return;
    const next = !shopOpen;
    if (!next && !window.confirm("Close the shop? Customers will see \"We're closed\" and can't order until you open again.")) return;
    setShopBusy(true);
    const { error } = await supabase()
      .from("shop_status")
      .update({ is_open: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setShopBusy(false);
    if (error) {
      window.alert(`Couldn't change it: ${error.message}`);
      return;
    }
    setShopOpen(next);
  };

  const refreshAll = useCallback(() => {
    loadActive();
    setRefreshKey((k) => k + 1);
  }, [loadActive]);

  // Initial load + realtime + safety polling
  useEffect(() => {
    loadMenu();
    loadActive();
    loadShop();
    const db = supabase();
    const ch = db
      .channel("staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => refreshAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => loadMenu())
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_status" }, () => loadShop())
      .subscribe();
    const poll = setInterval(loadActive, 15000);
    setSoundOn(audioReady());
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission);
    return () => {
      db.removeChannel(ch);
      clearInterval(poll);
    };
  }, [loadMenu, loadActive, loadShop, refreshAll]);

  const unseen = active.filter((o) => o.status === "new" && !o.seen);

  // Alarm loop: keeps ringing until every new order has been opened
  useEffect(() => {
    if (!unseen.length) {
      document.title = `Staff · ${BRAND.name}`;
      return;
    }
    let flip = false;
    const ring = () => {
      chime();
      flip = !flip;
      document.title = flip ? `🔔 ${unseen.length} NEW ORDER${unseen.length > 1 ? "S" : ""}` : `Staff · ${BRAND.name}`;
    };
    ring();
    const t = setInterval(ring, 2500);
    return () => clearInterval(t);
  }, [unseen.length]);

  const openOrder = async (o: Order) => {
    setOpenId(o.id);
    setOpenSnapshot(o);
    if (o.status === "new" && !o.seen) {
      setActive((list) => list.map((x) => (x.id === o.id ? { ...x, seen: true } : x)));
      await supabase().from("orders").update({ seen: true }).eq("id", o.id);
    }
  };

  // Keep the open modal in sync with live data
  const openOrderData = active.find((o) => o.id === openId) ?? openSnapshot;

  const enableAlerts = async () => {
    setSoundOn(unlockAudio());
    chime();
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await askNotifications();
      setNotifPerm(Notification.permission);
    }
  };

  return (
    <div className="staff">
      <div className="staff-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" />
        <strong className="display" style={{ fontSize: 18 }}>{BRAND.name}</strong>
        <span className="grow" />
        {shopOpen !== null && (
          <button
            className={`btn shop-toggle ${shopOpen ? "is-open" : "is-closed"}`}
            onClick={toggleShop}
            disabled={shopBusy}
            aria-pressed={shopOpen}
            title={shopOpen ? "Customers can order. Tap to close the shop." : "Ordering is paused. Tap to open the shop."}
          >
            <span className="shop-dot" aria-hidden />
            {shopOpen ? "Open" : "Closed"}
          </button>
        )}
        <button className="btn" onClick={() => setShowQr(true)}>QR code</button>
        <button className="btn btn-ghost small" onClick={() => supabase().auth.signOut()} title={email}>
          Sign out
        </button>
      </div>

      {(!soundOn || notifPerm === "default") && (
        <div className="row between wrap" style={{ padding: "10px 16px", background: "var(--surface-2)" }}>
          <span className="small">Turn on alerts so new orders ring on this device.</span>
          <button className="btn btn-primary" onClick={enableAlerts}>Enable sound & notifications</button>
        </div>
      )}

      {unseen.length > 0 && (
        <div className="alert-banner">
          <span>
            🔔 {unseen.length} new order{unseen.length > 1 ? "s" : ""}: {unseen.map((o) => o.customer_name).join(", ")}
          </span>
          <button
            className="btn"
            style={{ background: "#fff", color: "#000" }}
            onClick={() => {
              setTab("active");
              openOrder(unseen[0]);
            }}
          >
            Open
          </button>
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === "active" && active.length > 0 && <span className="badge">{active.length}</span>}
          </button>
        ))}
      </nav>

      <main className="panel">
        {tab === "active" && <Active orders={active} onOpen={openOrder} />}
        {tab === "add" && <AddItems menu={menu} onDone={refreshAll} />}
        {tab === "history" && <History onOpen={openOrder} refreshKey={refreshKey} />}
        {tab === "report" && <Report refreshKey={refreshKey} />}
        {tab === "menu" && <MenuToggle menu={menu} onChanged={loadMenu} />}
      </main>

      {openOrderData && (
        <OrderModal
          key={openOrderData.id + openOrderData.status}
          order={openOrderData}
          onClose={() => {
            setOpenId(null);
            setOpenSnapshot(null);
          }}
          onChanged={refreshAll}
        />
      )}

      {showQr && <QrModal onClose={() => setShowQr(false)} />}
    </div>
  );
}

function notifyNewOrder(o: Order) {
  const items = (o.order_items ?? []).map((i) => `${i.qty}× ${i.name}`).join(", ");
  notify(`New order: ${o.customer_name}`, items || `Order #${o.order_no}`, o.id);
}
