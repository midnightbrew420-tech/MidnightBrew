export type MenuItem = {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
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

export const CATEGORY_ORDER = ["Coffee", "Non-Coffee", "Tea", "Food", "Dessert"];

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
