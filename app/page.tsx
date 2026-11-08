"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRAND, money } from "@/lib/brand";
import { MenuItem, Variant, cartKey, lineName, parseKey, priceOptions, sortMenu } from "@/lib/types";
import Thumb from "@/components/Thumb";
import Cat from "@/components/Cat";

type Cart = Record<string, number>; // "<menu_item_id>|<hot|iced|>" -> qty

const CART_KEY = "mb_cart_v2";
// Older versions saved the customer's name and last order on the phone; these are cleared on load.
const OLD_KEYS = ["mb_name", "mb_last_order"];

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
  // One-time confirmation after ordering. Nothing about the order is kept on the phone.
  const [sent, setSent] = useState<{ total: number } | null>(null);

  // Load menu + keep availability live
  useEffect(() => {
    setCart(load(CART_KEY, {}));
    try {
      OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {}
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

  const byId = useMemo(() => Object.fromEntries(menu.map((m) => [m.id, m])), [menu]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(menu.map((m) => m.category)))], [menu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.filter(
      (m) =>
        (cat === "All" || m.category === cat) &&
        (!q ||
          m.name.toLowerCase().includes(q) ||
          (m.name_th ?? "").includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q))
    );
  }, [menu, query, cat]);

  const grouped = useMemo(() => {
    const g: Record<string, MenuItem[]> = {};
    for (const m of filtered) (g[m.category] ||= []).push(m);
    return Object.entries(g);
  }, [filtered]);

  const cartLines = Object.entries(cart)
    .map(([key, qty]) => {
      const { id, variant } = parseKey(key);
      const item = byId[id];
      const opt = item && priceOptions(item).find((o) => o.variant === variant);
      return item && opt && qty > 0 ? { key, item, variant, qty, price: opt.price } : null;
    })
    .filter((l): l is { key: string; item: MenuItem; variant: Variant; qty: number; price: number } => !!l);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.qty * l.price, 0);
  const unavailableInCart = cartLines.filter((l) => !l.item.available);

  const setQty = (key: string, q: number) =>
    setCart((c) => {
      const n = { ...c };
      if (q <= 0) delete n[key];
      else n[key] = Math.min(q, 50);
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
    const { data, error } = await supabase().rpc("place_order", {
      p_customer_name: name.trim(),
      p_items: cartLines.map((l) => ({ id: l.item.id, variant: l.variant || null, qty: l.qty })),
      p_note: note.trim() || null,
    });
    setPlacing(false);
    if (error) {
      setError(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setSent({ total: Number(row?.total ?? cartTotal) });
    setCart({});
    setName("");
    setNote("");
    setShowCart(false);
  };

  return (
    <>
      <header className="cust-header">
        <div style={{ maxWidth: 728, margin: "0 auto" }}>
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" />
            <div>
              <h1>{BRAND.name}</h1>
              <div className="tag">{BRAND.tagline}</div>
            </div>
            <span className="grow" />
            <Cat className="brand-cat" />
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
                const opts = priceOptions(m);
                return (
                  <article key={m.id} className={`card item ${m.available ? "" : "off"}`}>
                    <Thumb item={m} />
                    <div className="item-body">
                      <div className="item-name">{m.name}</div>
                      {m.name_th && <div className="item-th">{m.name_th}</div>}
                      <div className="item-desc">{m.description}</div>
                      <div className="opts">
                        {!m.available ? (
                          <span className="pill">Sold out</span>
                        ) : (
                          opts.map((o) => {
                            const key = cartKey(m.id, o.variant);
                            const q = cart[key] || 0;
                            return (
                              <div className="opt" key={key}>
                                <span className="opt-label">
                                  {o.label && <span className="muted">{o.label} </span>}
                                  <span className="price">{money(o.price)}</span>
                                </span>
                                {q === 0 ? (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setQty(key, 1)}
                                    aria-label={`Add ${lineName(m, o.variant)}`}
                                  >
                                    Add
                                  </button>
                                ) : (
                                  <span className="qty">
                                    <button className="icon-btn" onClick={() => setQty(key, q - 1)} aria-label="Remove one">
                                      −
                                    </button>
                                    {q}
                                    <button className="icon-btn" onClick={() => setQty(key, q + 1)} aria-label="Add one">
                                      +
                                    </button>
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {!loading && !loadError && (
          <footer className="cust-footer">
            <div className="small">Thank you for supporting local &amp; happy people.</div>
            <div className="script">See you at Midnight.</div>
            <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
              {BRAND.instagram}
            </a>
            <div className="footer-line">COFFEE | FRIENDS | MIDNIGHT</div>
          </footer>
        )}
      </main>

      {cartCount > 0 && !showCart && (
        <div className="cart-bar">
          <button className="btn btn-primary btn-block" onClick={() => setShowCart(true)}>
            <span>View cart · {cartCount} item{cartCount > 1 ? "s" : ""}</span>
            <span>{money(cartTotal)}</span>
          </button>
        </div>
      )}

      {sent && (
        <div className="overlay" onClick={() => setSent(null)}>
          <div className="sheet sent" role="alertdialog" aria-labelledby="sent-title" onClick={(e) => e.stopPropagation()}>
            <div className="sent-mark" aria-hidden>
              ✓
            </div>
            <h2 id="sent-title">Order sent</h2>
            <p className="muted">
              Our staff have your order and will be with you shortly. Please pay{" "}
              <strong className="price">{money(sent.total)}</strong> when they come to you.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => setSent(null)} autoFocus>
              Done
            </button>
          </div>
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
            {cartLines.map(({ key, item, variant, qty, price }) => (
              <div className="line" key={key}>
                <Thumb item={item} size={48} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{lineName(item, variant)}</div>
                  <div className="muted small">
                    {money(price)} each{!item.available && <span className="error"> · sold out</span>}
                  </div>
                </div>
                <span className="qty">
                  <button className="icon-btn" onClick={() => setQty(key, qty - 1)}>
                    −
                  </button>
                  {qty}
                  <button className="icon-btn" onClick={() => setQty(key, qty + 1)} disabled={!item.available}>
                    +
                  </button>
                </span>
                <div style={{ width: 64, textAlign: "right", fontWeight: 600 }}>{money(qty * price)}</div>
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
