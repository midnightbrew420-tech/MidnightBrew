"use client";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { STAFF_ORDER_PAYMENTS, PAYMENT_LABELS, money } from "@/lib/brand";
import type { MenuItem } from "@/lib/types";
import PayPicker from "./PayPicker";
import Thumb from "@/components/Thumb";

type Line = { item: MenuItem; qty: number };

export default function AddItems({ menu, onDone }: { menu: MenuItem[]; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [adjType, setAdjType] = useState<"discount" | "surcharge">("discount");
  const [adjUnit, setAdjUnit] = useState<"amount" | "percent">("amount");
  const [adjValue, setAdjValue] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return menu.filter((m) => !s || m.name.toLowerCase().includes(s) || m.category.toLowerCase().includes(s));
  }, [menu, q]);

  const list = Object.values(lines);
  const subtotal = list.reduce((s, l) => s + l.qty * Number(l.item.price), 0);
  const v = Math.max(0, Number(adjValue) || 0);
  const adjAbs = Math.round((adjUnit === "percent" ? (subtotal * Math.min(v, 100)) / 100 : v) * 100) / 100;
  const adjustment = adjType === "discount" ? -Math.min(adjAbs, subtotal) : adjAbs;
  const total = Math.max(0, subtotal + adjustment);

  const add = (m: MenuItem, d: number) =>
    setLines((ls) => {
      const n = { ...ls };
      const qty = (n[m.id]?.qty ?? 0) + d;
      if (qty <= 0) delete n[m.id];
      else n[m.id] = { item: m, qty };
      return n;
    });

  const reset = () => {
    setLines({});
    setName("");
    setNote("");
    setAdjValue("");
    setMethod(null);
  };

  const submit = async () => {
    setErr("");
    setMsg("");
    if (!list.length) return setErr("Add at least one item.");
    if (!method) return setErr("Choose a payment method.");
    setBusy(true);
    const db = supabase();
    const t = new Date().toISOString();
    const { data: order, error } = await db
      .from("orders")
      .insert({
        customer_name: name.trim() || (method === "grabfood" ? "GrabFood" : "Walk-in"),
        note: note.trim() || null,
        source: "staff",
        status: "paid",
        payment_method: method,
        subtotal,
        adjustment,
        total,
        seen: true,
        taken_at: t,
        paid_at: t,
        closed_at: t,
      })
      .select()
      .single();
    if (error || !order) {
      setBusy(false);
      return setErr(error?.message ?? "Could not save order");
    }
    const { error: e2 } = await db.from("order_items").insert(
      list.map((l) => ({
        order_id: order.id,
        menu_item_id: l.item.id,
        name: l.item.name,
        unit_price: l.item.price,
        qty: l.qty,
        line_total: Number(l.item.price) * l.qty,
      }))
    );
    if (e2) {
      await db.from("orders").delete().eq("id", order.id);
      setBusy(false);
      return setErr(e2.message);
    }
    setBusy(false);
    setMsg(`Saved #${order.order_no} · ${money(total)} via ${PAYMENT_LABELS[method]}`);
    reset();
    onDone();
  };

  return (
    <div className="two-col">
      <div className="card" style={{ padding: 14 }}>
        <input placeholder="Search menu…" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        <div style={{ marginTop: 8 }}>
          {shown.map((m) => (
            <div className="line" key={m.id} style={{ opacity: m.available ? 1 : 0.5 }}>
              <Thumb item={m} size={40} />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div className="muted small">
                  {m.category} · {money(m.price)} {!m.available && "· sold out"}
                </div>
              </div>
              {lines[m.id] ? (
                <span className="qty">
                  <button className="icon-btn" onClick={() => add(m, -1)}>−</button>
                  {lines[m.id].qty}
                  <button className="icon-btn" onClick={() => add(m, 1)}>+</button>
                </span>
              ) : (
                <button className="btn" style={{ padding: "6px 12px" }} onClick={() => add(m, 1)}>
                  Add
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card stack" style={{ padding: 14, position: "sticky", top: 120 }}>
        <h3>Ticket</h3>
        {list.length === 0 && <div className="muted small">No items yet.</div>}
        {list.map((l) => (
          <div className="row between small" key={l.item.id}>
            <span>
              {l.qty}× {l.item.name}
            </span>
            <span>{money(l.qty * Number(l.item.price))}</span>
          </div>
        ))}
        <input placeholder="Customer name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />

        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Adjust total</span>
          <div className="row wrap">
            <div className="seg">
              <button className={adjType === "discount" ? "on" : ""} onClick={() => setAdjType("discount")}>Discount</button>
              <button className={adjType === "surcharge" ? "on" : ""} onClick={() => setAdjType("surcharge")}>Charge more</button>
            </div>
            <div className="seg">
              <button className={adjUnit === "amount" ? "on" : ""} onClick={() => setAdjUnit("amount")}>Amount</button>
              <button className={adjUnit === "percent" ? "on" : ""} onClick={() => setAdjUnit("percent")}>%</button>
            </div>
          </div>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={adjUnit === "percent" ? "e.g. 10 (%)" : "e.g. 20"}
            value={adjValue}
            onChange={(e) => setAdjValue(e.target.value)}
          />
        </div>

        <div className="row between small"><span className="muted">Subtotal</span><span>{money(subtotal)}</span></div>
        {adjustment !== 0 && (
          <div className="row between small">
            <span className="muted">{adjustment < 0 ? "Discount" : "Surcharge"}</span>
            <span>{money(adjustment)}</span>
          </div>
        )}
        <div className="total-row" style={{ padding: "4px 0" }}><span>Total</span><span className="price">{money(total)}</span></div>

        <span className="small muted">Payment method</span>
        <PayPicker methods={STAFF_ORDER_PAYMENTS} value={method} onChange={setMethod} />
        {err && <div className="error">{err}</div>}
        {msg && <div style={{ color: "var(--ok)" }}>{msg}</div>}
        <button className="btn btn-ok btn-block" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : `Charge ${money(total)}`}
        </button>
        {list.length > 0 && <button className="btn btn-ghost" onClick={reset}>Clear</button>}
      </div>
    </div>
  );
}
