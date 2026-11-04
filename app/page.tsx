"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRAND, money } from "@/lib/brand";
import { MenuItem, sortMenu } from "@/lib/types";
import Thumb from "@/components/Thumb";

type Cart = Record<string, number>; // menu_item_id -> qty
type Placed = { id: string; order_no: number; total: number; name: string };

const CART_KEY = "mb_cart";
const NAME_KEY = "mb_name";
const LAST_KEY = "mb_last_order";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export default function CustomerMenu() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<Cart>({});
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [status, setStatus] = useState<string>("");

  // Load menu + keep availability live
  useEffect(() => {
    setCart(load(CART_KEY, {}));
    setName(load(NAME_KEY, ""));
    setPlaced(load(LAST_KEY, null));
    let db;
    try {
      db = supabase();
    } catch (e) {
      setLoadError((e as Error).message);
      setLoading(false);
      return;
    }
    const fetchMenu = async () => {
      const { data, error } = await db.from("menu_items").select("*");
      if (error) setLoadError(error.message);
      else setMenu(sortMenu(data as MenuItem[]));
      setLoading(false);
    };
    fetchMenu();
    const ch = db
      .channel("menu-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, fetchMenu)
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, []);

  useEffect(() => save(CART_KEY, cart), [cart]);

  // Poll status of the last placed order so the customer sees progress
  useEffect(() => {
    if (!placed) return;
    let stop = false;
    const tick = async () => {
      const { data } = await supabase().rpc("order_status", { p_order_id: placed.id });
      if (!stop && typeof data === "string") setStatus(data);
    };
    tick();
    const t = setInterval(tick, 10000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [placed]);

  const byId = useMemo(() => Object.fromEntries(menu.map((m) => [m.id, m])), [menu]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map((m) => m.category)))], [menu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.filter(
      (m) =>
        (cat === "All" || m.category === cat) &&
        (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
    );
  }, [menu, query, cat]);

  const grouped = useMemo(() => {
    const g: Record<string, MenuItem[]> = {};
    for (const m of filtered) (g[m.category] ||= []).push(m);
    return Object.entries(g);
  }, [filtered]);

  const cartLines = Object.entries(cart)
    .filter(([id, q]) => q > 0 && byId[id])
    .map(([id, q]) => ({ item: byId[id], qty: q }));
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.qty * Number(l.item.price), 0);
  const unavailableInCart = cartLines.filter((l) => !l.item.available);

  const setQty = (id: string, q: number) =>
    setCart((c) => {
      const n = { ...c };
      if (q <= 0) delete n[id];
      else n[id] = Math.min(q, 50);
      return n;
    });

  const placeOrder = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter your name so we can call you.");
      return;
    }
    if (unavailableInCart.length) {
      setError("Some items just sold out — please remove them first.");
      return;
    }
    setPlacing(true);
    save(NAME_KEY, name.trim());
    const { data, error } = await supabase().rpc("place_order", {
      p_customer_name: name.trim(),
      p_items: cartLines.map((l) => ({ id: l.item.id, qty: l.qty })),
      p_note: note.trim() || null,
    });
    setPlacing(false);
    if (error) {
      setError(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const p: Placed = { id: row.id, order_no: row.order_no, total: Number(row.total), name: name.trim() };
    setPlaced(p);
    setStatus("new");
    save(LAST_KEY, p);
    setCart({});
    setNote("");
    setShowCart(false);
  };

  const statusText: Record<string, string> = {
    new: "Sent! Our staff will be with you shortly.",
    taken: "Your order has been taken and is being prepared.",
    paid: "Paid — thank you! Enjoy.",
    cancelled: "This order was cancelled. Please speak to our staff.",
    unpaid: "Please see our staff to settle this order.",
  };

  return (
    <>
      <header className="cust-header">
        <div style={{ maxWidth: 728, margin: "0 auto" }}>
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" />
            <div>
              <h1>{BRAND.name}</h1>
              <div className="tag">{BRAND.tagline}</div>
            </div>
          </div>
          <div className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Search the menu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search menu"
            />
          </div>
          <div className="chips">
            {categories.map((c) => (
              <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="menu">
        {placed && status && (
          <div className="card" style={{ padding: 14, marginTop: 8, borderColor: "var(--accent)" }}>
            <div className="row between">
              <strong>
                Order #{placed.order_no} · {placed.name}
              </strong>
              <span className={`pill ${status}`}>{status}</span>
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {statusText[status] ?? ""} Total {money(placed.total)}
            </div>
            {(status === "paid" || status === "cancelled") && (
              <button
                className="btn btn-ghost small"
                style={{ marginTop: 8, padding: "4px 0" }}
                onClick={() => {
                  setPlaced(null);
                  save(LAST_KEY, null);
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {loading && <div className="empty">Loading menu…</div>}
        {loadError && <div className="empty error">{loadError}</div>}
        {!loading && !loadError && grouped.length === 0 && (
          <div className="empty">No items match “{query}”.</div>
        )}

        {grouped.map(([category, items]) => (
          <section key={category}>
            <h2 className="cat-title">{category}</h2>
            <div className="items">
              {items.map((m) => {
                const q = cart[m.id] || 0;
                return (
                  <article key={m.id} className={`card item ${m.available ? "" : "off"}`}>
                    <Thumb item={m} />
                    <div className="item-body">
                      <div className="item-name">{m.name}</div>
                      <div className="item-desc">{m.description}</div>
                      <div className="item-foot">
                        <span className="price">{money(m.price)}</span>
                        {!m.available ? (
                          <span className="pill">Sold out</span>
                        ) : q === 0 ? (
                          <button className="btn btn-primary" style={{ padding: "6px 14px" }} onClick={() => setQty(m.id, 1)}>
                            Add
                          </button>
                        ) : (
                          <span className="qty">
                            <button className="icon-btn" onClick={() => setQty(m.id, q - 1)} aria-label="Remove one">
                              −
                            </button>
                            {q}
                            <button className="icon-btn" onClick={() => setQty(m.id, q + 1)} aria-label="Add one">
                              +
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {cartCount > 0 && !showCart && (
        <div className="cart-bar">
          <button className="btn btn-primary btn-block" onClick={() => setShowCart(true)}>
            <span>View cart · {cartCount} item{cartCount > 1 ? "s" : ""}</span>
            <span>{money(cartTotal)}</span>
          </button>
        </div>
      )}

      {showCart && (
        <div className="overlay" onClick={() => setShowCart(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row between">
              <h2>Your order</h2>
              <button className="icon-btn" onClick={() => setShowCart(false)} aria-label="Close">
                ✕
              </button>
            </div>
            {cartLines.length === 0 && <div className="empty">Your cart is empty.</div>}
            {cartLines.map(({ item, qty }) => (
              <div className="line" key={item.id}>
                <Thumb item={item} size={48} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div className="muted small">
                    {money(item.price)} each{!item.available && <span className="error"> · sold out</span>}
                  </div>
                </div>
                <span className="qty">
                  <button className="icon-btn" onClick={() => setQty(item.id, qty - 1)}>
                    −
                  </button>
                  {qty}
                  <button className="icon-btn" onClick={() => setQty(item.id, qty + 1)} disabled={!item.available}>
                    +
                  </button>
                </span>
                <div style={{ width: 70, textAlign: "right", fontWeight: 600 }}>{money(qty * Number(item.price))}</div>
              </div>
            ))}
            <div className="total-row">
              <span>Total</span>
              <span className="price">{money(cartTotal)}</span>
            </div>
            <div className="stack">
              <label className="stack" style={{ gap: 4 }}>
                <span className="small muted">Your name (we&apos;ll call this out)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Aung" />
              </label>
              <label className="stack" style={{ gap: 4 }}>
                <span className="small muted">Note (optional)</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  placeholder="Less sugar, no ice, table by the window…"
                />
              </label>
              {error && <div className="error">{error}</div>}
              <button
                className="btn btn-primary btn-block"
                disabled={placing || cartLines.length === 0}
                onClick={placeOrder}
              >
                {placing ? "Sending…" : `Place order · ${money(cartTotal)}`}
              </button>
              <div className="muted small" style={{ textAlign: "center" }}>
                No payment here — pay our staff when they come to you.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
