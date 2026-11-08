"use client";
import { Order, sugarLabel } from "@/lib/types";
import { money } from "@/lib/brand";
import { minutesAgo } from "@/lib/dates";

export default function Active({ orders, onOpen }: { orders: Order[]; onOpen: (o: Order) => void }) {
  const fresh = orders.filter((o) => o.status === "new");
  const taken = orders.filter((o) => o.status === "taken");
  const ready = orders.filter((o) => o.status === "ready");
  const pillText = (o: Order) => (o.status === "new" ? (o.seen ? "new" : "NEW!") : o.status);

  const Card = ({ o }: { o: Order }) => {
    const n = (o.order_items ?? []).reduce((s, i) => s + i.qty, 0);
    return (
      <button className={`card order-card ${o.status === "new" && !o.seen ? "unseen" : ""}`} onClick={() => onOpen(o)}>
        <div className="row between">
          <span className="order-name">{o.customer_name}</span>
          <span className={`pill ${o.status}`}>{pillText(o)}</span>
        </div>
        <div className="muted small" style={{ margin: "4px 0 8px" }}>
          #{o.order_no} · {minutesAgo(o.created_at)}
        </div>
        <div className="small">
          {(o.order_items ?? []).slice(0, 4).map((i) => (
            <div key={i.id}>
              {i.qty}× {i.name}
              {i.sugar != null && <span className="sugar-tag">{sugarLabel(i.sugar)}</span>}
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
        <h3 style={{ marginBottom: 10 }}>Taken: being prepared ({taken.length})</h3>
        {taken.length ? (
          <div className="grid-orders">{taken.map((o) => <Card key={o.id} o={o} />)}</div>
        ) : (
          <div className="muted small">Nothing being prepared.</div>
        )}
      </section>
      <section>
        <h3 style={{ marginBottom: 10 }}>Ready: awaiting payment ({ready.length})</h3>
        {ready.length ? (
          <div className="grid-orders">{ready.map((o) => <Card key={o.id} o={o} />)}</div>
        ) : (
          <div className="muted small">Nothing awaiting payment.</div>
        )}
      </section>
    </div>
  );
}
