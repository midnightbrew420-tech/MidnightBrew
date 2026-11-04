"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/brand";
import { MenuItem, priceOptions } from "@/lib/types";
import Thumb from "@/components/Thumb";

export default function MenuToggle({ menu, onChanged }: { menu: MenuItem[]; onChanged: () => void }) {
  const [err, setErr] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const groups: Record<string, MenuItem[]> = {};
  for (const m of menu) (groups[m.category] ||= []).push(m);
  const off = menu.filter((m) => !m.available).length;

  const toggle = async (m: MenuItem) => {
    setErr("");
    setPending((p) => ({ ...p, [m.id]: !m.available }));
    const { error } = await supabase().from("menu_items").update({ available: !m.available }).eq("id", m.id);
    if (error) setErr(error.message);
    await onChanged();
    setPending((p) => {
      const n = { ...p };
      delete n[m.id];
      return n;
    });
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="muted">
        {off ? `${off} item${off > 1 ? "s" : ""} switched off (shown as “Sold out” to customers).` : "Everything is available."}
      </div>
      {err && <div className="error">{err}</div>}
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat} className="card" style={{ padding: "4px 14px" }}>
          <h3 style={{ margin: "12px 0 4px", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 15 }}>{cat}</h3>
          {items.map((m) => {
            const on = pending[m.id] ?? m.available;
            return (
              <label className="line" key={m.id} style={{ cursor: "pointer" }}>
                <Thumb item={m} size={40} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div className="muted small">
                    {priceOptions(m).map((o) => `${o.label ? o.label + " " : ""}${money(o.price)}`).join(" / ")} ·{" "}
                    {on ? "Available" : "Sold out"}
                  </div>
                </div>
                <span className="switch">
                  <input type="checkbox" checked={on} onChange={() => toggle(m)} />
                  <span />
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
