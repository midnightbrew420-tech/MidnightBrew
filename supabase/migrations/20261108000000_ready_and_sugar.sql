-- =====================================================================
-- "Ready" step for orders, and sugar level on drinks.
--   orders.status gains 'ready' (new -> taken -> ready -> paid)
--   orders.ready_at: when staff pressed Ready
--   order_items.sugar: 0 / 25 / 50 / 75 / 100 (%) for drinks, null otherwise
-- Safe to re-run.
-- =====================================================================

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'taken', 'ready', 'paid', 'cancelled', 'unpaid'));

alter table public.orders add column if not exists ready_at timestamptz;

alter table public.order_items add column if not exists sugar smallint;
alter table public.order_items drop constraint if exists order_items_sugar_check;
alter table public.order_items add constraint order_items_sugar_check
  check (sugar is null or sugar in (0, 25, 50, 75, 100));

-- place_order now also reads "sugar" for each line:
-- items: [{ "id": "<menu_item uuid>", "variant": "hot" | "iced" | null, "sugar": 0..100 | null, "qty": 2 }, ...]
-- Sugar is kept only for drinks (not Snacks or Extra) and only for the five allowed levels.
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
             case
               when m.category in ('Snacks', 'Extra') then null
               when v.sugar in (0, 25, 50, 75, 100) then v.sugar
             end::smallint as sugar,
             case v.variant
               when 'hot'  then m.price_hot
               when 'iced' then m.price_iced
               else case when m.price_hot is null and m.price_iced is null then m.price end
             end as unit_price,
             v.qty
      from (
        select (x->>'id')::uuid as id,
               lower(coalesce(x->>'variant', '')) as variant,
               case when (x->>'sugar') ~ '^\d{1,3}$' then (x->>'sugar')::int end as sugar,
               least(greatest(coalesce((x->>'qty')::int, 1), 1), 50) as qty
        from jsonb_array_elements(p_items) x
      ) v
      join menu_items m on m.id = v.id
      where m.available = true
    ) q
    where q.unit_price is not null
  loop
    insert into order_items (order_id, menu_item_id, name, variant, sugar, unit_price, qty, line_total)
    values (v_order_id, v_item.id, v_item.name, v_item.variant, v_item.sugar, v_item.unit_price, v_item.qty, v_item.unit_price * v_item.qty);
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

revoke all on function public.place_order(text, jsonb, text) from public;
grant execute on function public.place_order(text, jsonb, text) to anon, authenticated;
