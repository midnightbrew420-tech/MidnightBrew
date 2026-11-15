import { locationName } from "@/lib/types";

// Small coloured label for an order's location (THR / EUP / MG).
export default function LocationTag({ code, full = false }: { code: string | null | undefined; full?: boolean }) {
  if (!code) return null;
  return (
    <span className={`loc-tag loc-${code}`} title={locationName(code)}>
      {full ? `${code} · ${locationName(code)}` : code}
    </span>
  );
}
