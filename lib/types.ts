export type MenuItem = {
  id: string;
  category: string;
  name: string;
  name_th: string | null;
  description: string;
  price: number;
  price_hot: number | null;
  price_iced: number | null;
  image_url: string | null;
  available: boolean;
  sort_order: number;
};

export type OrderStatus = "new" | "taken" | "ready" | "paid" | "cancelled" | "unpaid";
export type PaymentMethod = "qr" | "cash" | "card" | "grabfood";

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  variant: string | null;
  sugar: number | null;
  unit_price: number;
  qty: number;
  line_total: number;
};

export type Order = {
  id: string;
  order_no: number;
  customer_name: string;
  location?: string | null; // THR / EUP / MG (null for staff entries and older orders)
  note: string | null;
  source: "customer" | "staff";
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  adjustment: number;
  total: number;
  seen: boolean;
  created_at: string;
  taken_at: string | null;
  ready_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  order_items?: OrderItem[];
};

export const CATEGORY_ORDER = ["Coffee", "Non-Coffee", "Italian Soda", "Special", "Snacks", "Extra"];

export function sortMenu(items: MenuItem[]) {
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? 999 : i;
  };
  return [...items].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      a.category.localeCompare(b.category) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name)
  );
}

export type Variant = "hot" | "iced" | "";
export type PriceOption = { variant: Variant; label: string; price: number };

/** The ways an item can be ordered: Hot / Iced, or a single price. */
export function priceOptions(m: MenuItem): PriceOption[] {
  const o: PriceOption[] = [];
  if (m.price_hot != null) o.push({ variant: "hot", label: "Hot", price: Number(m.price_hot) });
  if (m.price_iced != null) o.push({ variant: "iced", label: "Iced", price: Number(m.price_iced) });
  return o.length ? o : [{ variant: "", label: "", price: Number(m.price) }];
}

export function lineName(m: MenuItem, v: Variant) {
  return m.name + (v === "hot" ? " (Hot)" : v === "iced" ? " (Iced)" : "");
}

// Sugar level (%) for drinks. Snacks and extras have none.
// The three places customers order from with the shared QR code.
export const LOCATIONS = [
  { code: "THR", name: "The High Roof Top" },
  { code: "EUP", name: "Euphoria" },
  { code: "MG", name: "Mango" },
] as const;
export type LocationCode = (typeof LOCATIONS)[number]["code"];
export const isLocation = (c: unknown): c is LocationCode => LOCATIONS.some((l) => l.code === c);
export const locationName = (c: string | null | undefined) => LOCATIONS.find((l) => l.code === c)?.name ?? "";

// An order's location and note. If the database doesn't have the location column yet,
// the menu sends the location at the start of the note instead ("[THR] no ice").
export function orderPlace(o: { location?: string | null; note: string | null }): { location: string | null; note: string | null } {
  const m = (o.note ?? "").match(/^\[(THR|EUP|MG)\]\s*/);
  const note = m ? (o.note ?? "").slice(m[0].length) || null : o.note;
  return { location: isLocation(o.location) ? o.location : m ? m[1] : null, note };
}

export const SUGAR_LEVELS = [0, 25, 50, 75, 100] as const;
export const DEFAULT_SUGAR = 100;
const NOT_DRINKS = ["Snacks", "Extra"];
export const isDrink = (m: Pick<MenuItem, "category">) => !NOT_DRINKS.includes(m.category);
export function sugarLabel(level: number | null | undefined) {
  if (level == null) return "";
  if (level === 0) return "No sugar";
  if (level === 100) return "Normal sugar";
  return `Sugar ${level}%`;
}

/** Cart line key: item, Hot/Iced and sugar level ("" when not a drink). */
export const cartKey = (id: string, v: Variant, sugar: number | null = null) => `${id}|${v}|${sugar ?? ""}`;
export const parseKey = (k: string) => {
  const [id, v = "", s = ""] = k.split("|");
  return { id, variant: v as Variant, sugar: s === "" ? null : Number(s) };
};
