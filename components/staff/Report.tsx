"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { supabase } from "@/lib/supabase";
import { BRAND, STAFF_ORDER_PAYMENTS, money } from "@/lib/brand";
import { payLabel, useLang } from "@/lib/i18n";
import { dayRange, fromDateInput, monthRange, toDateInput, toMonthInput } from "@/lib/dates";
import type { Order } from "@/lib/types";

type Mode = "day" | "month";

export default function Report({ refreshKey }: { refreshKey: number }) {
  const { lang, t } = useLang();
  const loc = lang === "th" ? "th-TH" : [];
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
      ? fromDateInput(day).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : fromDateInput(month + "-01").toLocaleDateString(loc, { month: "long", year: "numeric" });

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
          <button className={mode === "day" ? "on" : ""} onClick={() => setMode("day")}>{t("daily")}</button>
          <button className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>{t("monthly")}</button>
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
          {exporting ? t("exporting") : t("exportJpg")}
        </button>
      </div>
      {err && <div className="error">{err}</div>}

      <div ref={ref} className="report">
        <div className="row between wrap">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" style={{ width: 40, height: 40 }} />
            <div>
              <h2 style={{ fontSize: 22 }}>{BRAND.name}</h2>
              <div className="muted small">{mode === "day" ? t("dailyReport") : t("monthlyReport")}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>{title}</div>
            <div className="muted small">{t("generated")} {new Date().toLocaleString(loc)}</div>
          </div>
        </div>

        {loading ? (
          <div className="muted" style={{ padding: 30 }}>{t("loading")}</div>
        ) : (
          <>
            <div className="stats">
              <div className="stat"><div className="k">{t("totalSales")}</div><div className="v price">{money(r.total)}</div></div>
              <div className="stat"><div className="k">{t("paidOrders")}</div><div className="v">{r.count}</div></div>
              <div className="stat"><div className="k">{t("avgOrder")}</div><div className="v">{money(r.avg)}</div></div>
              <div className="stat"><div className="k">{t("qrStaff")}</div><div className="v">{r.qrOrders} / {r.staffOrders}</div></div>
            </div>

            <h3 style={{ margin: "18px 0 6px" }}>{t("byPay")}</h3>
            <table className="table">
              <thead><tr><th>{t("method")}</th><th className="num">{t("orders")}</th><th className="num">{t("amount")}</th></tr></thead>
              <tbody>
                {Object.entries(r.byPay).map(([m, v]) => (
                  <tr key={m}><td>{payLabel(lang, m)}</td><td className="num">{v.count}</td><td className="num">{money(v.total)}</td></tr>
                ))}
                <tr><td><strong>{t("total")}</strong></td><td className="num"><strong>{r.count}</strong></td><td className="num"><strong>{money(r.total)}</strong></td></tr>
              </tbody>
            </table>

            <h3 style={{ margin: "18px 0 6px" }}>{t("byItem")}</h3>
            {r.items.length === 0 ? (
              <div className="muted small">{t("noItemsSold")}</div>
            ) : (
              <table className="table">
                <thead><tr><th>{t("item")}</th><th className="num">{t("qty")}</th><th className="num">{t("amount")}</th></tr></thead>
                <tbody>
                  {r.items.map(([n, v]) => (
                    <tr key={n}><td>{n}</td><td className="num">{v.qty}</td><td className="num">{money(v.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}

            {mode === "month" && r.days.length > 0 && (
              <>
                <h3 style={{ margin: "18px 0 6px" }}>{t("byDay")}</h3>
                <table className="table">
                  <thead><tr><th>{t("date")}</th><th className="num">{t("orders")}</th><th className="num">{t("amount")}</th></tr></thead>
                  <tbody>
                    {r.days.map(([d, v]) => (
                      <tr key={d}>
                        <td>{fromDateInput(d).toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" })}</td>
                        <td className="num">{v.count}</td><td className="num">{money(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <h3 style={{ margin: "18px 0 6px" }}>{t("summary")}</h3>
            <table className="table">
              <tbody>
                <tr><td>{t("itemsSold")}</td><td className="num">{money(r.gross)}</td></tr>
                <tr><td>{t("discounts")}</td><td className="num">{money(r.discounts)}</td></tr>
                <tr><td>{t("extraCharges")}</td><td className="num">{money(r.surcharges)}</td></tr>
                <tr><td><strong>{t("totalCollected")}</strong></td><td className="num"><strong>{money(r.total)}</strong></td></tr>
                <tr><td className="muted">{t("cancelledOrders")}</td><td className="num muted">{r.cancelled}</td></tr>
                <tr>
                  <td className="muted">{t("unpaidOrders")}</td>
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
