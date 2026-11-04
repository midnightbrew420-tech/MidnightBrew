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

export type OrderStatus = "new" | "taken" | "paid" | "cancelled" | "unpaid";
export type PaymentMethod = "qr" | "cash" | "card" | "grabfood";

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  variant: string | null;
  unit_price: number;
  qty: number;
  line_total: number;
};

export type Order = {
  id: string;
  order_no: number;
  customer_name: string;
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

export const cartKey = (id: string, v: Variant) => `${id}|${v}`;
export const parseKey = (k: string) => {
  const [id, v = ""] = k.split("|");
  return { id, variant: v as Variant };
};
