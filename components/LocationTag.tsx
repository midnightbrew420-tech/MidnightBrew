import { locationName } from "@/lib/types";

// Small coloured label for an order's location (THR / EUP / MG), with the room number if there is one.
export default function LocationTag({
  code,
  room,
  full = false,
}: {
  code: string | null | undefined;
  room?: string | null;
  full?: boolean;
}) {
  if (!code) return null;
  const label = full ? `${code} · ${locationName(code)}` : code;
  return (
    <span className={`loc-tag loc-${code}`} title={`${locationName(code)}${room ? `, room ${room}` : ""}`}>
      {label}
      {room ? (full ? ` · Room ${room}` : ` · ${room}`) : ""}
    </span>
  );
}
