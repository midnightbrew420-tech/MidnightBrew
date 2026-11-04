"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVE_ORDER_PAYMENTS, PAYMENT_LABELS, money } from "@/lib/brand";
import { dateTimeShort } from "@/lib/dates";
import type { Order } from "@/lib/types";
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
  const open = order.status === "new" || order.status === "taken" || order.status === "unpaid";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div>
            <h2 style={{ marginBottom: 2 }}>{order.customer_name}</h2>
            <div className="muted small">
              #{order.order_no} · {dateTimeShort(order.created_at)} · {order.source === "staff" ? "Staff entry" : "QR order"}
            </div>
          </div>
          <span className={`pill ${order.status}`}>{order.status}</span>
        </div>

        <div style={{ marginTop: 12 }}>
          {(order.order_items ?? []).map((li) => (
            <div className="line" key={li.id}>
              <strong style={{ width: 34 }}>{li.qty}×</strong>
              <span className="grow">{li.name}</span>
              <span>{money(li.line_total)}</span>
            </div>
          ))}
          {Number(order.adjustment) !== 0 && (
            <>
              <div className="line muted">
                <span className="grow">Subtotal</span>
                <span>{money(order.subtotal)}</span>
              </div>
              <div className="line muted">
                <span className="grow">{Number(order.adjustment) < 0 ? "Discount" : "Surcharge"}</span>
                <span>{money(order.adjustment)}</span>
              </div>
            </>
          )}
          <div className="total-row">
            <span>Total</span>
            <span className="price">{money(order.total)}</span>
          </div>
          {order.note && (
            <div className="card" style={{ padding: 10, marginBottom: 12 }}>
              <span className="muted small">Note: </span>
              {order.note}
            </div>
          )}
          {order.payment_method && (
            <div className="muted small" style={{ marginBottom: 12 }}>
              Paid by <strong>{PAYMENT_LABELS[order.payment_method]}</strong> · {dateTimeShort(order.paid_at)}
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
              Take order
            </button>
          )}
          {(order.status === "taken" || order.status === "unpaid") && (
            <button className="btn btn-ok btn-block" disabled={busy} onClick={() => setPaying(true)}>
              Order paid
            </button>
          )}
          {open && (
            <div className="row">
              {order.status !== "unpaid" && (
                <button className="btn grow" disabled={busy} onClick={() => setConfirm("unpaid")}>
                  Mark unpaid
                </button>
              )}
              <button className="btn btn-danger grow" disabled={busy} onClick={() => setConfirm("cancelled")}>
                Cancel order
              </button>
            </div>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {paying && (
        <div className="overlay" onClick={(e) => (e.stopPropagation(), setPaying(false))}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>How did {order.customer_name} pay?</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Total <strong className="price">{money(order.total)}</strong>
            </p>
            <PayPicker methods={ACTIVE_ORDER_PAYMENTS} value={method} onChange={setMethod} />
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn grow" onClick={() => setPaying(false)}>
                Back
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
                Confirm {method ? PAYMENT_LABELS[method] : ""} payment
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="overlay" onClick={(e) => (e.stopPropagation(), setConfirm(null))}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{confirm === "cancelled" ? "Cancel this order?" : "Mark as unpaid?"}</h2>
            <p className="muted">
              {confirm === "cancelled"
                ? "It will move to Paid/Cancelled history and won't count in sales."
                : "Use this when the customer left without paying. It stays in history and can still be marked paid later."}
            </p>
            <div className="row">
              <button className="btn grow" onClick={() => setConfirm(null)}>
                Back
              </button>
              <button
                className={`btn grow ${confirm === "cancelled" ? "btn-danger" : "btn-primary"}`}
                disabled={busy}
                onClick={async () => {
                  if (await update({ status: confirm, closed_at: now(), seen: true })) onClose();
                }}
              >
                Yes, {confirm === "cancelled" ? "cancel" : "mark unpaid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
