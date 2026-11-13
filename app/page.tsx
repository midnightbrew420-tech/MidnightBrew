"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRAND, money } from "@/lib/brand";
import {
  DEFAULT_SUGAR, MenuItem, SUGAR_LEVELS, Variant, cartKey, isDrink, lineName, parseKey, priceOptions, sortMenu, sugarLabel,
} from "@/lib/types";
import { askNotifications, notify } from "@/lib/notify";
import { chime, unlockAudio } from "@/components/staff/alarm";
import Thumb from "@/components/Thumb";
import Cat from "@/components/Cat";

type Cart = Record<string, number>; // "<menu_item_id>|<hot|iced|>|<sugar|>" -> qty
type Line = { key: string; item: MenuItem; variant: Variant; sugar: number | null; qty: number; price: number };
type Picker = { item: MenuItem; variant: Variant; price: number };

// Each name has its own cart: { "<name>": cart }. Kept in this browser tab only, like the name,
// so a cart never shows up under someone else's name.
const CARTS_KEY = "mb_carts_by_name";
// The order this tab is waiting for (its id only: no name, no items), so it can tell the customer when it's ready.
// Kept in this browser tab only, like the name.
const WAIT_KEY = "mb_waiting_order";
// The customer's name for this visit. Kept only in this browser tab (forgotten when it closes).
const GUEST_KEY = "mb_guest_name";
// Older versions saved the customer's name and last order on the phone; these are cleared on load.
const OLD_KEYS = ["mb_name", "mb_last_order", "mb_cart_v2", "mb_cart_v3", "mb_waiting_order"];

function loadTab<T>(key: string, fallback: T): T {
  try {
    const v = sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveTab(key: string, v: unknown) {
  try {
    if (v == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(v));
  } catch {}
}
const cartOwner = (n: string) => n.trim().toLowerCase();
function loadCart(n: string): Cart {
  return loadTab<Record<string, Cart>>(CARTS_KEY, {})[cartOwner(n)] ?? {};
}
function saveCart(n: string, cart: Cart) {
  const all = loadTab<Record<string, Cart>>(CARTS_KEY, {});
  if (Object.keys(cart).length) all[cartOwner(n)] = cart;
  else delete all[cartOwner(n)];
  saveTab(CARTS_KEY, all);
}

export default function CustomerMenu() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<Cart>({});
  const [name, setName] = useState(""); // what's typed on the name screen
  const [guest, setGuest] = useState(""); // the name this cart belongs to
  const [entered, setEntered] = useState<boolean | null>(null); // null until we've checked this tab
  const [note, setNote] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  // Confirmation after ordering, then this phone watches its own order until it's ready.
  const [sent, setSent] = useState<{ total: number } | null>(null);
  const [waiting, setWaiting] = useState<{ id: string; status: string } | null>(null);
  const [readyAlert, setReadyAlert] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [shopOpen, setShopOpen] = useState(true); // staff can close the shop; then ordering pauses
  const [hours, setHours] = useState(""); // opening hours text set by staff
  const [pickSugar, setPickSugar] = useState<number>(DEFAULT_SUGAR);
  const [pickQty, setPickQty] = useState(1);

  // Load menu + keep availability live
  useEffect(() => {
    try {
      const g = sessionStorage.getItem(GUEST_KEY);
      if (g) {
        setName(g);
        setGuest(g);
        setCart(loadCart(g));
      }
      setEntered(!!g);
    } catch {
      setEntered(false);
    }
    const w = loadTab<{ id: string } | null>(WAIT_KEY, null);
    if (w?.id) setWaiting({ id: w.id, status: "new" });
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
    const fetchShop = async () => {
      const { data } = await db.from("shop_status").select("*").eq("id", 1).maybeSingle();
      if (data) {
        setShopOpen(data.is_open !== false); // no row or no table yet: treat as open
        setHours(typeof data.hours === "string" ? data.hours.trim() : "");
      }
    };
    fetchMenu();
    fetchShop();
    const ch = db
      .channel("menu-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, fetchMenu)
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_status" }, fetchShop)
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (guest) saveCart(guest, cart);
  }, [guest, cart]);

  // Watch this phone's own order. When staff press Ready: big message, chime, vibration and a notification.
  const waitingId = waiting?.id;
  useEffect(() => {
    if (!waitingId) return;
    let stop = false;
    let last = "";
    const tick = async () => {
      const { data } = await supabase().rpc("order_status", { p_order_id: waitingId });
      if (stop || typeof data !== "string") return;
      if (data === "ready" && last !== "ready") {
        setReadyAlert(true);
        chime();
        try {
          navigator.vibrate?.([300, 150, 300, 150, 300]);
        } catch {}
        notify(`${BRAND.name}: your order is ready`, "Our staff will call your name.", "order-ready");
      }
      last = data;
      if (["paid", "cancelled", "unpaid"].includes(data)) {
        saveTab(WAIT_KEY, null);
        setWaiting(null);
        return;
      }
      setWaiting({ id: waitingId, status: data });
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [waitingId]);

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
      const { id, variant, sugar } = parseKey(key);
      const item = byId[id];
      const opt = item && priceOptions(item).find((o) => o.variant === variant);
      return item && opt && qty > 0 ? { key, item, variant, sugar, qty, price: opt.price } : null;
    })
    .filter((l): l is Line => !!l);
  const inCart = (id: string, v: Variant) => cartLines.filter((l) => l.item.id === id && l.variant === v).reduce((s, l) => s + l.qty, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.qty * l.price, 0);
  const unavailableInCart = cartLines.filter((l) => !l.item.available);

  const openPicker = (item: MenuItem, variant: Variant, price: number) => {
    setPickSugar(DEFAULT_SUGAR);
    setPickQty(1);
    setPicker({ item, variant, price });
  };
  const addPicked = () => {
    if (!picker) return;
    const key = cartKey(picker.item.id, picker.variant, pickSugar);
    setCart((c) => ({ ...c, [key]: Math.min((c[key] || 0) + pickQty, 50) }));
    setPicker(null);
  };

  const setQty = (key: string, q: number) =>
    setCart((c) => {
      const n = { ...c };
      if (q <= 0) delete n[key];
      else n[key] = Math.min(q, 50);
      return n;
    });

  const placeOrder = async () => {
    setError("");
    if (!shopOpen) {
      setError("Sorry, we're closed right now. Please order again when we open.");
      return;
    }
    if (!guest) {
      setEntered(false);
      return;
    }
    if (unavailableInCart.length) {
      setError("Some items just sold out — please remove them first.");
      return;
    }
    setPlacing(true);
    unlockAudio(); // this tap lets the phone chime later, when the order is ready
    askNotifications();
    const { data, error } = await supabase().rpc("place_order", {
      p_customer_name: guest,
      p_items: cartLines.map((l) => ({ id: l.item.id, variant: l.variant || null, sugar: l.sugar, qty: l.qty })),
      p_note: note.trim() || null,
    });
    setPlacing(false);
    if (error) {
      setError(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setSent({ total: Number(row?.total ?? cartTotal) });
    if (row?.id) {
      saveTab(WAIT_KEY, { id: row.id });
      setReadyAlert(false);
      setWaiting({ id: row.id, status: "new" });
    }
    setCart({});
    setNote("");
    setShowCart(false);
  };

  const enter = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().slice(0, 60);
    if (!n) return;
    setName(n);
    try {
      sessionStorage.setItem(GUEST_KEY, n);
    } catch {}
    // Switch to this name's own cart (empty for a new name).
    if (cartOwner(n) !== cartOwner(guest)) {
      setCart(loadCart(n));
      setNote("");
    }
    setGuest(n);
    setEntered(true);
  };

  if (entered === null) return null; // checking this tab for a name; avoids a flash of the wrong screen

  if (!entered)
    return (
      <main className="welcome">
        <form className="welcome-card" onSubmit={enter}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={BRAND.name} className="welcome-logo" />
          <h1>{BRAND.name}</h1>
          <p className="tag">{BRAND.tagline}</p>
          <label htmlFor="guest-name" className="welcome-label">
            What&apos;s your name?
          </label>
          <input
            id="guest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Aung"
            autoComplete="given-name"
            autoFocus
          />
          <button className="btn btn-primary btn-block" disabled={!name.trim()}>
            See the menu
          </button>
          <p className="muted small">We&apos;ll call this name when your order is ready.</p>
        </form>
        <Cat className="brand-cat" />
      </main>
    );

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
            <button
              className="cart-btn"
              onClick={() => setShowCart(true)}
              aria-label={cartCount ? `Cart, ${cartCount} item${cartCount > 1 ? "s" : ""}` : "Cart, empty"}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 4h2.2l2.1 10.4a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.5L20.5 8H6.2" />
                <circle cx="10" cy="20" r="1.4" />
                <circle cx="17" cy="20" r="1.4" />
              </svg>
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
          <div className="hours-line" role="status">
            <span className={`open-badge ${shopOpen ? "is-open" : "is-closed"}`}>
              <span className="open-dot" aria-hidden />
              {shopOpen ? "Open now" : "Closed now"}
            </span>
            {hours && (
              <span className="hours-text">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <span>
                  Opening hours: <strong>{hours}</strong>
                </span>
              </span>
            )}
          </div>
          <div className="guest">
            Ordering as <strong>{guest}</strong> ·{" "}
            <button type="button" className="link-btn" onClick={() => setEntered(false)}>
              Change
            </button>
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
        {!shopOpen && (
          <div className="closed-banner" role="status">
            <strong>We&apos;re closed right now.</strong>
            <span>You can look at the menu. Ordering opens again when we do.</span>
            {hours && <span className="closed-hours">Opening hours: {hours}</span>}
          </div>
        )}
        {waiting && (
          <div className={`tracker ${waiting.status === "ready" ? "is-ready" : ""}`} role="status">
            <span className="tracker-dot" aria-hidden />
            <span className="grow">
              {waiting.status === "ready"
                ? "Your order is ready. Our staff will call your name."
                : waiting.status === "taken"
                ? "Your order is being prepared."
                : "Your order has been sent to our staff."}
            </span>
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
                            if (isDrink(m)) {
                              const n = inCart(m.id, o.variant);
                              return (
                                <div className="opt" key={o.variant || "one"}>
                                  <span className="opt-label">
                                    {o.label && <span className="muted">{o.label} </span>}
                                    <span className="price">{money(o.price)}</span>
                                    {n > 0 && <span className="in-cart">{n} in cart</span>}
                                  </span>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    disabled={!shopOpen}
                                    onClick={() => openPicker(m, o.variant, o.price)}
                                    aria-label={`Add ${lineName(m, o.variant)}`}
                                  >
                                    Add
                                  </button>
                                </div>
                              );
                            }
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
                                    disabled={!shopOpen}
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
            <Cat className="brand-cat" />
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

      {picker && (
        <div className="overlay" onClick={() => setPicker(null)}>
          <div className="sheet" role="dialog" aria-labelledby="pick-title" onClick={(e) => e.stopPropagation()}>
            <div className="row between">
              <h2 id="pick-title" style={{ marginBottom: 0 }}>{lineName(picker.item, picker.variant)}</h2>
              <button className="icon-btn" onClick={() => setPicker(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="muted small" style={{ margin: "4px 0 14px" }}>{money(picker.price)} each</div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>Sweetness</div>
            <div className="sugar-grid" role="radiogroup" aria-label="Sweetness">
              {SUGAR_LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  role="radio"
                  aria-checked={pickSugar === lv}
                  className={`sugar-opt ${pickSugar === lv ? "on" : ""}`}
                  onClick={() => setPickSugar(lv)}
                >
                  <strong>{lv}%</strong>
                  <span>{lv === 0 ? "No sugar" : lv === 100 ? "Normal" : lv === 25 ? "Very light" : lv === 50 ? "Half" : "Less"}</span>
                </button>
              ))}
            </div>
            <div className="row between" style={{ margin: "16px 0" }}>
              <span style={{ fontWeight: 600 }}>Quantity</span>
              <span className="qty">
                <button className="icon-btn" onClick={() => setPickQty((q) => Math.max(1, q - 1))} aria-label="One less">
                  −
                </button>
                {pickQty}
                <button className="icon-btn" onClick={() => setPickQty((q) => Math.min(50, q + 1))} aria-label="One more">
                  +
                </button>
              </span>
            </div>
            <button className="btn btn-primary btn-block" onClick={addPicked}>
              Add to cart · {money(picker.price * pickQty)}
            </button>
          </div>
        </div>
      )}

      {readyAlert && (
        <div className="overlay" onClick={() => setReadyAlert(false)}>
          <div className="sheet sent ready" role="alertdialog" aria-labelledby="ready-title" onClick={(e) => e.stopPropagation()}>
            <div className="sent-mark" aria-hidden>
              ☕
            </div>
            <h2 id="ready-title">Your order is ready</h2>
            <p className="muted">Our staff will call your name.</p>
            <button className="btn btn-primary btn-block" onClick={() => setReadyAlert(false)} autoFocus>
              OK
            </button>
          </div>
        </div>
      )}

      {sent && (
        <div className="overlay" onClick={() => setSent(null)}>
          <div className="sheet sent" role="alertdialog" aria-labelledby="sent-title" onClick={(e) => e.stopPropagation()}>
            <div className="sent-mark" aria-hidden>
              ✓
            </div>
            <h2 id="sent-title">Thank you{guest ? `, ${guest}` : ""}!</h2>
            <p className="thanks-line">Your order has been sent. Enjoy your treat!</p>
            <p className="muted">
              Keep this page open and we&apos;ll let you know when it&apos;s ready. Please pay{" "}
              <strong className="price">{money(sent.total)}</strong> to our staff.
            </p>
            <p className="thanks-tag">{BRAND.tagline}</p>
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
            {cartLines.map(({ key, item, variant, sugar, qty, price }) => (
              <div className="line" key={key}>
                <Thumb item={item} size={48} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{lineName(item, variant)}</div>
                  <div className="muted small">
                    {sugar != null && <>{sugarLabel(sugar)} · </>}
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
              <div className="small muted">
                Ordering as <strong style={{ color: "var(--text)" }}>{name}</strong>
              </div>
              <label className="stack" style={{ gap: 4 }}>
                <span className="small muted">Note (optional)</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  placeholder="No ice, extra hot, table by the window…"
                />
              </label>
              {error && <div className="error">{error}</div>}
              <button
                className="btn btn-primary btn-block"
                disabled={placing || cartLines.length === 0 || !shopOpen}
                onClick={placeOrder}
              >
                {!shopOpen ? "Closed: ordering paused" : placing ? "Sending…" : `Place order · ${money(cartTotal)}`}
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
