"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { supabase } from "@/lib/supabase";
import { BRAND, PAYMENT_LABELS, STAFF_ORDER_PAYMENTS, money } from "@/lib/brand";
import { dayRange, fromDateInput, monthRange, toDateInput, toMonthInput } from "@/lib/dates";
import type { Order } from "@/lib/types";

type Mode = "day" | "month";

export default function Report({ refreshKey }: { refreshKey: number }) {
  const [mode, setMode] = useState<Mode>("day");
  const [day, setDay] = useState(toDateInput(new Date()));
  const [month, setMonth] = useState(toMonthInput(new Date()));
  const [paid, setPaid] = useState<Order[]>([]);
  const [lost, setLost] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const range = useMemo(
    () => (mode === "day" ? dayRange(fromDateInput(day)) : monthRange(fromDateInput(month + "-01"))),
    [mode, day, month]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase();
    const s = range.start.toISOString();
    const e = range.end.toISOString();
    const [p, l] = await Promise.all([
      db.from("orders").select("*, order_items(*)").eq("status", "paid").gte("paid_at", s).lt("paid_at", e).order("paid_at"),
      db.from("orders").select("id,status,total").in("status", ["cancelled", "unpaid"]).gte("created_at", s).lt("created_at", e),
    ]);
    setLoading(false);
    if (p.error || l.error) return setErr((p.error || l.error)!.message);
    setErr("");
    setPaid(p.data as Order[]);
    setLost(l.data as Order[]);
  }, [range]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const r = useMemo(() => {
    const byPay: Record<string, { count: number; total: number }> = {};
    for (const m of STAFF_ORDER_PAYMENTS) byPay[m] = { count: 0, total: 0 };
    const byItem: Record<string, { qty: number; total: number }> = {};
    const byDay: Record<string, { count: number; total: number }> = {};
    let total = 0, gross = 0, discounts = 0, surcharges = 0, qrOrders = 0, staffOrders = 0;
    for (const o of paid) {
      const t = Number(o.total);
      total += t;
      gross += Number(o.subtotal);
      const a = Number(o.adjustment);
      if (a < 0) discounts += a; else surcharges += a;
      if (o.source === "staff") staffOrders++; else qrOrders++;
      const pm = o.payment_method ?? "cash";
      (byPay[pm] ||= { count: 0, total: 0 });
      byPay[pm].count++;
      byPay[pm].total += t;
      for (const i of o.order_items ?? []) {
        (byItem[i.name] ||= { qty: 0, total: 0 });
        byItem[i.name].qty += i.qty;
        byItem[i.name].total += Number(i.line_total);
      }
      const dk = toDateInput(new Date(o.paid_at!));
      (byDay[dk] ||= { count: 0, total: 0 });
      byDay[dk].count++;
      byDay[dk].total += t;
    }
    return {
      total, gross, discounts, surcharges, qrOrders, staffOrders,
      count: paid.length,
      avg: paid.length ? total / paid.length : 0,
      byPay,
      items: Object.entries(byItem).sort((a, b) => b[1].qty - a[1].qty || b[1].total - a[1].total),
      days: Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])),
      cancelled: lost.filter((x) => x.status === "cancelled").length,
      unpaid: lost.filter((x) => x.status === "unpaid"),
    };
  }, [paid, lost]);

  const title =
    mode === "day"
      ? fromDateInput(day).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : fromDateInput(month + "-01").toLocaleDateString([], { month: "long", year: "numeric" });

  const shift = (d: number) => {
    if (mode === "day") {
      const x = fromDateInput(day);
      x.setDate(x.getDate() + d);
      setDay(toDateInput(x));
    } else {
      const x = fromDateInput(month + "-01");
      x.setMonth(x.getMonth() + d);
      setMonth(toMonthInput(x));
    }
  };

  const exportJpg = async () => {
    if (!ref.current) return;
    setExporting(true);
    const bg = getComputedStyle(document.body).backgroundColor;
    const opts = { quality: 0.95, pixelRatio: 2, backgroundColor: bg };
    let url: string;
    try {
      url = await toJpeg(ref.current, opts);
    } catch {
      url = await toJpeg(ref.current, { ...opts, skipFonts: true });
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${BRAND.name.replace(/\s+/g, "-")}-report-${mode === "day" ? day : month}.jpg`;
    a.click();
    setExporting(false);
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row wrap">
        <div className="seg">
          <button className={mode === "day" ? "on" : ""} onClick={() => setMode("day")}>Daily</button>
          <button className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>Monthly</button>
        </div>
        <button className="btn" onClick={() => shift(-1)}>‹</button>
        {mode === "day" ? (
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} style={{ width: 170 }} />
        ) : (
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} style={{ width: 170 }} />
        )}
        <button className="btn" onClick={() => shift(1)}>›</button>
        <span className="grow" />
        <button className="btn btn-primary" onClick={exportJpg} disabled={exporting || loading}>
          {exporting ? "Exporting…" : "Export JPG"}
        </button>
      </div>
      {err && <div className="error">{err}</div>}

      <div ref={ref} className="report">
        <div className="row between wrap">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" style={{ width: 40, height: 40 }} />
            <div>
              <h2 style={{ fontSize: 22 }}>{BRAND.name}</h2>
              <div className="muted small">{mode === "day" ? "Daily" : "Monthly"} sales report</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>{title}</div>
            <div className="muted small">Generated {new Date().toLocaleString()}</div>
          </div>
        </div>

        {loading ? (
          <div className="muted" style={{ padding: 30 }}>Loading…</div>
        ) : (
          <>
            <div className="stats">
              <div className="stat"><div className="k">Total sales</div><div className="v price">{money(r.total)}</div></div>
              <div className="stat"><div className="k">Paid orders</div><div className="v">{r.count}</div></div>
              <div className="stat"><div className="k">Average order</div><div className="v">{money(r.avg)}</div></div>
              <div className="stat"><div className="k">QR / Staff</div><div className="v">{r.qrOrders} / {r.staffOrders}</div></div>
            </div>

            <h3 style={{ margin: "18px 0 6px" }}>By payment method</h3>
            <table className="table">
              <thead><tr><th>Method</th><th className="num">Orders</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {Object.entries(r.byPay).map(([m, v]) => (
                  <tr key={m}><td>{PAYMENT_LABELS[m] ?? m}</td><td className="num">{v.count}</td><td className="num">{money(v.total)}</td></tr>
                ))}
                <tr><td><strong>Total</strong></td><td className="num"><strong>{r.count}</strong></td><td className="num"><strong>{money(r.total)}</strong></td></tr>
              </tbody>
            </table>

            <h3 style={{ margin: "18px 0 6px" }}>By menu item</h3>
            {r.items.length === 0 ? (
              <div className="muted small">No items sold.</div>
            ) : (
              <table className="table">
                <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {r.items.map(([n, v]) => (
                    <tr key={n}><td>{n}</td><td className="num">{v.qty}</td><td className="num">{money(v.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}

            {mode === "month" && r.days.length > 0 && (
              <>
                <h3 style={{ margin: "18px 0 6px" }}>By day</h3>
                <table className="table">
                  <thead><tr><th>Date</th><th className="num">Orders</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {r.days.map(([d, v]) => (
                      <tr key={d}>
                        <td>{fromDateInput(d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</td>
                        <td className="num">{v.count}</td><td className="num">{money(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <h3 style={{ margin: "18px 0 6px" }}>Summary</h3>
            <table className="table">
              <tbody>
                <tr><td>Items sold (menu price)</td><td className="num">{money(r.gross)}</td></tr>
                <tr><td>Discounts</td><td className="num">{money(r.discounts)}</td></tr>
                <tr><td>Extra charges</td><td className="num">{money(r.surcharges)}</td></tr>
                <tr><td><strong>Total collected</strong></td><td className="num"><strong>{money(r.total)}</strong></td></tr>
                <tr><td className="muted">Cancelled orders</td><td className="num muted">{r.cancelled}</td></tr>
                <tr>
                  <td className="muted">Unpaid orders</td>
                  <td className="num muted">{r.unpaid.length} ({money(r.unpaid.reduce((s, o) => s + Number(o.total), 0))})</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
