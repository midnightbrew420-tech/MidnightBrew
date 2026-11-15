"use client";
import { payLabel, useLang } from "@/lib/i18n";

export default function PayPicker({
  methods,
  value,
  onChange,
}: {
  methods: readonly string[];
  value: string | null;
  onChange: (m: string) => void;
}) {
  const { lang } = useLang();
  return (
    <div className="pay-grid">
      {methods.map((m) => (
        <button key={m} type="button" className={`btn ${value === m ? "on" : ""}`} onClick={() => onChange(m)}>
          {payLabel(lang, m)}
        </button>
      ))}
    </div>
  );
}
