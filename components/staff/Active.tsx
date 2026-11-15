"use client";
import { Order, orderPlace, sugarLabel } from "@/lib/types";
import LocationTag from "@/components/LocationTag";
import { money } from "@/lib/brand";
import { agoText, sugarText, statusLabel, useLang } from "@/lib/i18n";

export default function Active({ orders, onOpen }: { orders: Order[]; onOpen: (o: Order) => void }) {
  const { lang, t } = useLang();
  const fresh = orders.filter((o) => o.status === "new");
  const taken = orders.filter((o) => o.status === "taken");
  const ready = orders.filter((o) => o.status === "ready");
  const pillText = (o: Order) => (o.status === "new" ? (o.seen ? t("st_new") : t("st_NEW")) : statusLabel(lang, o.status));

  const Card = ({ o }: { o: Order }) => {
    const n = (o.order_items ?? []).reduce((s, i) => s + i.qty, 0);
    const { location, room, note } = orderPlace(o);
    return (
      <button className={`card order-card ${o.status === "new" && !o.seen ? "unseen" : ""}`} onClick={() => onOpen(o)}>
        <div className="row between">
          <span className="order-name">
            <LocationTag code={location} room={room} /> {o.customer_name}
          </span>
          <span className={`pill ${o.status}`}>{pillText(o)}</span>
        </div>
        <div className="muted small" style={{ margin: "4px 0 8px" }}>
          #{o.order_no} · {agoText(lang, o.created_at)}
        </div>
        <div className="small">
          {(o.order_items ?? []).slice(0, 4).map((i) => (
            <div key={i.id}>
              {i.qty}× {i.name}
              {i.sugar != null && <span className="sugar-tag">{sugarText(lang, i.sugar)}</span>}
            </div>
          ))}
          {(o.order_items?.length ?? 0) > 4 && <div className="muted">{t("more", { n: (o.order_items?.length ?? 0) - 4 })}</div>}
        </div>
        {note && <div className="small" style={{ marginTop: 6, color: "var(--warn)" }}>{t("noteLabel")} {note}</div>}
        <div className="row between" style={{ marginTop: 10 }}>
          <span className="muted small">{t("itemsCount", { n })}</span>
          <strong className="price">{money(o.total)}</strong>
        </div>
      </button>
    );
  };

  if (orders.length === 0) return <div className="empty">{t("noActive")}</div>;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section>
        <h3 style={{ marginBottom: 10 }}>{t("secNew", { n: fresh.length })}</h3>
        {fresh.length ? (
          <div className="grid-orders">{fresh.map((o) => <Card key={o.id} o={o} />)}</div>
        ) : (
          <div className="muted small">{t("nothingWaiting")}</div>
        )}
      </section>
      <section>
        <h3 style={{ marginBottom: 10 }}>{t("secTaken", { n: taken.length })}</h3>
        {taken.length ? (
          <div className="grid-orders">{taken.map((o) => <Card key={o.id} o={o} />)}</div>
        ) : (
          <div className="muted small">{t("nothingTaken")}</div>
        )}
      </section>
      <section>
        <h3 style={{ marginBottom: 10 }}>{t("secReady", { n: ready.length })}</h3>
        {ready.length ? (
          <div className="grid-orders">{ready.map((o) => <Card key={o.id} o={o} />)}</div>
        ) : (
          <div className="muted small">{t("nothingReady")}</div>
        )}
      </section>
    </div>
  );
}
