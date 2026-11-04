-- =====================================================================
-- Midnight Brew — database schema (safe to re-run)
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Then run seed.sql to load the menu.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Menu ----------
create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  name        text not null,
  description text not null default '',
  price       numeric(10,2) not null check (price >= 0),
  image_url   text,
  available   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- Orders ----------
-- status:  new      -> customer just placed it (triggers staff alert)
--          taken    -> staff pressed "Take order"
--          paid     -> payment collected (counts in reports)
--          cancelled
--          unpaid   -> customer left without paying
-- source:  customer (QR menu) | staff (Add items tool)
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       bigint generated always as identity,
  customer_name  text not null check (char_length(customer_name) between 1 and 60),
  note           text,
  source         text not null default 'customer' check (source in ('customer','staff')),
  status         text not null default 'new' check (status in ('new','taken','paid','cancelled','unpaid')),
  payment_method text check (payment_method in ('qr','cash','card','grabfood')),
  subtotal       numeric(10,2) not null default 0,
  adjustment     numeric(10,2) not null default 0,  -- + surcharge / - discount
  total          numeric(10,2) not null default 0,
  seen           boolean not null default false,     -- staff opened it (stops the alarm)
  created_at     timestamptz not null default now(),
  taken_at       timestamptz,
  paid_at        timestamptz,
  closed_at      timestamptz
);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name         text not null,
  unit_price   numeric(10,2) not null,
  qty          int not null check (qty > 0),
  line_total   numeric(10,2) not null
);

-- Hot / Iced pricing. When price_hot or price_iced is set, customers pick
-- the version; otherwise the single "price" is used. "price" is also the
-- lowest price, for sorting.
alter table public.menu_items add column if not exists name_th    text;
alter table public.menu_items add column if not exists price_hot  numeric(10,2);
alter table public.menu_items add column if not exists price_iced numeric(10,2);
alter table public.order_items add column if not exists variant   text;

create index if not exists orders_status_idx  on public.orders(status);
create index if not exists orders_created_idx on public.orders(created_at);
create index if not exists orders_paid_idx    on public.orders(paid_at);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ---------- Row Level Security ----------
-- Customers (anonymous) may ONLY read the menu.
-- Orders are placed through the place_order() function below, which
-- looks up real prices on the server so totals can't be tampered with.
-- Staff (logged-in users) can do everything.
alter table public.menu_items  enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "menu readable by all" on public.menu_items;
create policy "menu readable by all" on public.menu_items
  for select using (true);

drop policy if exists "staff manage menu" on public.menu_items;
create policy "staff manage menu" on public.menu_items
  for all to authenticated using (true) with check (true);

drop policy if exists "staff manage orders" on public.orders;
create policy "staff manage orders" on public.orders
  for all to authenticated using (true) with check (true);

drop policy if exists "staff manage order items" on public.order_items;
create policy "staff manage order items" on public.order_items
  for all to authenticated using (true) with check (true);

-- ---------- Customer: place an order ----------
-- items: [{ "id": "<menu_item uuid>", "variant": "hot" | "iced" | null, "qty": 2 }, ...]
create or replace function public.place_order(p_customer_name text, p_items jsonb, p_note text default null)
returns table (id uuid, order_no bigint, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_no bigint;
  v_subtotal numeric(10,2) := 0;
  v_item record;
  v_count int := 0;
begin
  if p_customer_name is null or char_length(trim(p_customer_name)) = 0 then
    raise exception 'Name is required';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  insert into orders (customer_name, note, source, status)
  values (left(trim(p_customer_name), 60), nullif(left(trim(coalesce(p_note, '')), 300), ''), 'customer', 'new')
  returning orders.id, orders.order_no into v_order_id, v_order_no;

  for v_item in
    select * from (
      select m.id,
             m.name || case v.variant when 'hot' then ' (Hot)' when 'iced' then ' (Iced)' else '' end as name,
             nullif(v.variant, '') as variant,
             case v.variant
               when 'hot'  then m.price_hot
               when 'iced' then m.price_iced
               else case when m.price_hot is null and m.price_iced is null then m.price end
             end as unit_price,
             v.qty
      from (
        select (x->>'id')::uuid as id,
               lower(coalesce(x->>'variant', '')) as variant,
               least(greatest(coalesce((x->>'qty')::int, 1), 1), 50) as qty
        from jsonb_array_elements(p_items) x
      ) v
      join menu_items m on m.id = v.id
      where m.available = true
    ) q
    where q.unit_price is not null
  loop
    insert into order_items (order_id, menu_item_id, name, variant, unit_price, qty, line_total)
    values (v_order_id, v_item.id, v_item.name, v_item.variant, v_item.unit_price, v_item.qty, v_item.unit_price * v_item.qty);
    v_subtotal := v_subtotal + v_item.unit_price * v_item.qty;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Sorry, the selected items are no longer available';
  end if;

  update orders set subtotal = v_subtotal, total = v_subtotal where orders.id = v_order_id;

  return query select v_order_id, v_order_no, v_subtotal;
end;
$$;

-- ---------- Customer: check status of their own order ----------
create or replace function public.order_status(p_order_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select status from orders where id = p_order_id;
$$;

revoke all on function public.place_order(text, jsonb, text) from public;
revoke all on function public.order_status(uuid) from public;
grant execute on function public.place_order(text, jsonb, text) to anon, authenticated;
grant execute on function public.order_status(uuid) to anon, authenticated;

-- ---------- Realtime (new-order alerts + live menu availability) ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.menu_items;
  exception when duplicate_object then null;
  end;
end $$;
