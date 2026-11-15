"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/brand";
import { Key, payLabel, statusLabel, sugarText, useLang } from "@/lib/i18n";
import { dayRange, fromDateInput, timeShort, toDateInput } from "@/lib/dates";
import { Order, sugarLabel, orderPlace } from "@/lib/types";
import LocationTag from "@/components/LocationTag";

type Filter = "all" | "paid" | "cancelled" | "unpaid";

export default function History({ onOpen, refreshKey }: { onOpen: (o: Order) => void; refreshKey: number }) {
  const { lang, t } = useLang();
  const [date, setDate] = useState(toDateInput(new Date()));
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = dayRange(fromDateInput(date));
    let query = supabase()
      .from("orders")
      .select("*, order_items(*)")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    query = filter === "all" ? query.in("status", ["paid", "cancelled", "unpaid"]) : query.eq("status", filter);
    const { data, error } = await query;
    setLoading(false);
    if (error) setErr(error.message);
    else {
      setErr("");
      setRows(data as Order[]);
    }
  }, [date, filter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const shift = (d: number) => {
    const x = fromDateInput(date);
    x.setDate(x.getDate() + d);
    setDate(toDateInput(x));
  };

  const s = q.trim().toLowerCase();
  const shown = rows.filter((r) => !s || r.customer_name.toLowerCase().includes(s) || String(r.order_no).includes(s));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row wrap">
        <button className="btn" onClick={() => shift(-1)}>‹</button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 170 }} />
        <button className="btn" onClick={() => shift(1)}>›</button>
        <div className="seg">
          {(["all", "paid", "cancelled", "unpaid"] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {t(`f_${f}` as Key)}
            </button>
          ))}
        </div>
        <input placeholder={t("searchNameNo")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} />
      </div>
      {err && <div className="error">{err}</div>}
      {loading && <div className="muted">{t("loading")}</div>}
      {!loading && shown.length === 0 && <div className="empty">{t("noOrdersDay")}</div>}
      {shown.length > 0 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("th_time")}</th><th>#</th><th>{t("th_name")}</th><th>{t("th_items")}</th><th>{t("th_source")}</th><th>{t("th_status")}</th><th>{t("th_payment")}</th><th className="num">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} onClick={() => onOpen(o)} style={{ cursor: "pointer" }}>
                  <td>{timeShort(o.created_at)}</td>
                  <td>{o.order_no}</td>
                  <td>
                    <LocationTag code={orderPlace(o).location} room={orderPlace(o).room} /> {o.customer_name}
                  </td>
                  <td className="small">{(o.order_items ?? []).map((i) => `${i.qty}× ${i.name}${i.sugar != null ? ` (${sugarText(lang, i.sugar)})` : ""}`).join(", ")}</td>
                  <td className="small muted">{o.source === "staff" ? t("srcStaff") : t("srcQr")}</td>
                  <td><span className={`pill ${o.status}`}>{statusLabel(lang, o.status)}</span></td>
                  <td>{o.payment_method ? payLabel(lang, o.payment_method) : "—"}</td>
                  <td className="num">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
