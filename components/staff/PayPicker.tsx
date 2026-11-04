"use client";
import { PAYMENT_LABELS } from "@/lib/brand";

export default function PayPicker({
  methods,
  value,
  onChange,
}: {
  methods: readonly string[];
  value: string | null;
  onChange: (m: string) => void;
}) {
  return (
    <div className="pay-grid">
      {methods.map((m) => (
        <button key={m} type="button" className={`btn ${value === m ? "on" : ""}`} onClick={() => onChange(m)}>
          {PAYMENT_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
