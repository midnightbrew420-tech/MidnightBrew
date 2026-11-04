// ---------------------------------------------------------------
// BRANDING — edit this file (plus colors in app/globals.css and
// /public/logo.svg) to match the physical menu.
// ---------------------------------------------------------------
export const BRAND = {
  name: "Midnight Brew",
  tagline: "Good coffee. Late nights. Good vibes.",
  instagram: "@midnightbrew.bkk",
  instagramUrl: "https://instagram.com/midnightbrew.bkk",
  currency: "฿", // shown before every price
  currencyDecimals: 0,
};

export const PAYMENT_LABELS: Record<string, string> = {
  qr: "QR",
  cash: "Cash",
  card: "Card",
  grabfood: "GrabFood",
};

// Payment methods allowed per flow (as specified)
export const ACTIVE_ORDER_PAYMENTS = ["qr", "cash", "card"] as const;
export const STAFF_ORDER_PAYMENTS = ["qr", "cash", "card", "grabfood"] as const;

export function money(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  const sign = v < 0 ? "-" : "";
  return (
    sign +
    BRAND.currency +
    Math.abs(v).toLocaleString(undefined, {
      minimumFractionDigits: BRAND.currencyDecimals,
      maximumFractionDigits: 2,
    })
  );
}
