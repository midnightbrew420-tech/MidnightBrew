"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVE_ORDER_PAYMENTS, money } from "@/lib/brand";
import { payLabel, statusLabel, sugarText, useLang } from "@/lib/i18n";
import { dateTimeShort } from "@/lib/dates";
import { Order, sugarLabel, orderPlace } from "@/lib/types";
import LocationTag from "@/components/LocationTag";
import PayPicker from "./PayPicker";

export default function OrderModal({
  order,
  onClose,
  onChanged,
}: {
  order: Order;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { lang, t } = useLang();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancelled" | "unpaid" | null>(null);

  const update = async (patch: Partial<Order>) => {
    setBusy(true);
    setErr("");
    const { error } = await supabase().from("orders").update(patch).eq("id", order.id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return false;
    }
    onChanged();
    return true;
  };

  const now = () => new Date().toISOString();
  const open = ["new", "taken", "ready", "unpaid"].includes(order.status);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div>
            <h2 style={{ marginBottom: 2 }}>{order.customer_name}</h2>
            {orderPlace(order).location && (
              <div style={{ margin: "2px 0 4px" }}>
                <LocationTag code={orderPlace(order).location} room={orderPlace(order).room} full />
              </div>
            )}
            <div className="muted small">
              #{order.order_no} · {dateTimeShort(order.created_at)} · {order.source === "staff" ? t("staffEntry") : t("qrOrder")}
            </div>
          </div>
          <span className={`pill ${order.status}`}>{statusLabel(lang, order.status)}</span>
        </div>

        <div style={{ marginTop: 12 }}>
          {(order.order_items ?? []).map((li) => (
            <div className="line" key={li.id}>
              <strong style={{ width: 34 }}>{li.qty}×</strong>
              <span className="grow">
                {li.name}
                {li.sugar != null && <span className="sugar-tag">{sugarText(lang, li.sugar)}</span>}
              </span>
              <span>{money(li.line_total)}</span>
            </div>
          ))}
          {Number(order.adjustment) !== 0 && (
            <>
              <div className="line muted">
                <span className="grow">{t("subtotal")}</span>
                <span>{money(order.subtotal)}</span>
              </div>
              <div className="line muted">
                <span className="grow">{Number(order.adjustment) < 0 ? t("discount") : t("surcharge")}</span>
                <span>{money(order.adjustment)}</span>
              </div>
            </>
          )}
          <div className="total-row">
            <span>{t("total")}</span>
            <span className="price">{money(order.total)}</span>
          </div>
          {orderPlace(order).note && (
            <div className="card" style={{ padding: 10, marginBottom: 12 }}>
              <span className="muted small">{t("noteLabel")} </span>
              {orderPlace(order).note}
            </div>
          )}
          {order.payment_method && (
            <div className="muted small" style={{ marginBottom: 12 }}>
              {t("paidBy")} <strong>{payLabel(lang, order.payment_method)}</strong> · {dateTimeShort(order.paid_at)}
            </div>
          )}
        </div>

        {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}

        <div className="stack">
          {order.status === "new" && (
            <button
              className="btn btn-primary btn-block"
              disabled={busy}
              onClick={() => update({ status: "taken", taken_at: now(), seen: true })}
            >
              {t("takeOrder")}
            </button>
          )}
          {order.status === "taken" && (
            <button
              className="btn btn-primary btn-block"
              disabled={busy}
              onClick={() => update({ status: "ready", ready_at: now() })}
            >
              {t("readyTell")}
            </button>
          )}
          {(order.status === "ready" || order.status === "unpaid") && (
            <button className="btn btn-ok btn-block" disabled={busy} onClick={() => setPaying(true)}>
              {t("orderPaid")}
            </button>
          )}
          {open && (
            <div className="row">
              {order.status !== "unpaid" && (
                <button className="btn grow" disabled={busy} onClick={() => setConfirm("unpaid")}>
                  {t("markUnpaid")}
                </button>
              )}
              <button className="btn btn-danger grow" disabled={busy} onClick={() => setConfirm("cancelled")}>
                {t("cancelOrder")}
              </button>
            </div>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>

      {paying && (
        <div className="overlay" onClick={(e) => (e.stopPropagation(), setPaying(false))}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{t("howPay", { name: order.customer_name })}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {t("total")} <strong className="price">{money(order.total)}</strong>
            </p>
            <PayPicker methods={ACTIVE_ORDER_PAYMENTS} value={method} onChange={setMethod} />
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn grow" onClick={() => setPaying(false)}>
                {t("back")}
              </button>
              <button
                className="btn btn-ok grow"
                disabled={!method || busy}
                onClick={async () => {
                  const t = now();
                  if (
                    await update({ status: "paid", payment_method: method as Order["payment_method"], paid_at: t, closed_at: t, seen: true })
                  )
                    onClose();
                }}
              >
                {t("confirmPay", { m: method ? payLabel(lang, method) : "" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="overlay" onClick={(e) => (e.stopPropagation(), setConfirm(null))}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{confirm === "cancelled" ? t("cancelQ") : t("unpaidQ")}</h2>
            <p className="muted">
              {confirm === "cancelled"
                ? t("cancelInfo")
                : t("unpaidInfo")}
            </p>
            <div className="row">
              <button className="btn grow" onClick={() => setConfirm(null)}>
                {t("back")}
              </button>
              <button
                className={`btn grow ${confirm === "cancelled" ? "btn-danger" : "btn-primary"}`}
                disabled={busy}
                onClick={async () => {
                  if (await update({ status: confirm, closed_at: now(), seen: true })) onClose();
                }}
              >
                {confirm === "cancelled" ? t("yesCancel") : t("yesUnpaid")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
