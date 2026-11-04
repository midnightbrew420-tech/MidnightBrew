"use client";
import type { Order } from "@/lib/types";
import { money } from "@/lib/brand";
import { minutesAgo } from "@/lib/dates";

export default function Active({ orders, onOpen }: { orders: Order[]; onOpen: (o: Order) => void }) {
  const fresh = orders.filter((o) => o.status === "new");
  const taken = orders.filter((o) => o.status === "taken");

  const Card = ({ o }: { o: Order }) => {
    const n = (o.order_items ?? []).reduce((s, i) => s + i.qty, 0);
    return (
      <button className={`card order-card ${o.status === "new" && !o.seen ? "unseen" : ""}`} onClick={() => onOpen(o)}>
        <div className="row between">
          <span className="order-name">{o.customer_name}</span>
          <span className={`pill ${o.status}`}>{o.status === "new" ? (o.seen ? "new" : "NEW!") : "taken"}</span>
        </div>
        <div className="muted small" style={{ margin: "4px 0 8px" }}>
          #{o.order_no} · {minutesAgo(o.created_at)}
        </div>
        <div className="small">
          {(o.order_items ?? []).slice(0, 4).map((i) => (
            <div key={i.id}>
              {i.qty}× {i.name}
            </div>
          ))}
          {(o.order_items?.length ?? 0) > 4 && <div className="muted">+ {(o.order_items?.length ?? 0) - 4} more</div>}
        </div>
        {o.note && <div className="small" style={{ marginTop: 6, color: "var(--warn)" }}>Note: {o.note}</div>}
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="muted small">{n} item{n === 1 ? "" : "s"}</span>
          <strong className="price">{money(o.total)}</strong>
        </div>
      </button>
    );
  };

  if (orders.length === 0) return <div className="empty">No active orders. New QR orders will appear here with an alert.</div>;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section>
        <h3 style={{ marginBottom: 10 }}>New ({fresh.length})</h3>
        {fresh.length ? (
          <div className="grid-orders">{fresh.map((o) => <Card key={o.id} o={o} />)}</div>
        ) : (
          <div className="muted small">Nothing waiting.</div>
        )}
      </section>
      <section>
        <h3 style={{ marginBottom: 10 }}>Taken — awaiting payment ({taken.length})</h3>
        {taken.length ? (
          <div className="grid-orders">{taken.map((o) => <Card key={o.id} o={o} />)}</div>
        ) : (
          <div className="muted small">Nothing awaiting payment.</div>
        )}
      </section>
    </div>
  );
}
