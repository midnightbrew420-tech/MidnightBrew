-- =====================================================================
-- Push notifications that arrive even when the website is closed.
--   Staff devices: "New order" for every customer order (while the shop is open).
--   Customer devices: "Order accepted" / "Order ready" for their own order.
-- push_subscriptions holds each device's push address. Nobody can read it
-- through the public API; only the app's server (service key) can.
-- Safe to re-run.
-- =====================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  role       text not null check (role in ('staff', 'customer')),
  order_id   uuid references public.orders(id) on delete cascade,  -- customers: the order to follow
  lang       text not null default 'en' check (lang in ('en', 'th')),
  created_at timestamptz not null default now()
);
create unique index if not exists push_subscriptions_staff_endpoint
  on public.push_subscriptions (endpoint) where role = 'staff';
create unique index if not exists push_subscriptions_customer_order
  on public.push_subscriptions (endpoint, order_id) where role = 'customer';

alter table public.push_subscriptions enable row level security;
-- (no policies: the public API can't read or change it directly)

-- Each push goes out once per order and event.
alter table public.orders add column if not exists push_new_sent   boolean not null default false;
alter table public.orders add column if not exists push_taken_sent boolean not null default false;
alter table public.orders add column if not exists push_ready_sent boolean not null default false;

-- Save this device for pushes.
--   staff:    needs a logged-in staff account.
--   customer: needs the order it wants to follow (placed in the last day).
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_role text,
  p_order_id uuid default null, p_lang text default 'en'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lang text := case when p_lang = 'th' then 'th' else 'en' end;
begin
  if coalesce(p_endpoint, '') !~ '^https://' or char_length(p_endpoint) > 1000
     or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Invalid push subscription';
  end if;

  if p_role = 'staff' then
    if auth.uid() is null then
      raise exception 'Staff login required';
    end if;
    insert into push_subscriptions (endpoint, p256dh, auth, role, lang)
    values (p_endpoint, p_p256dh, p_auth, 'staff', v_lang)
    on conflict (endpoint) where role = 'staff'
    do update set p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang;

  elsif p_role = 'customer' then
    if not exists (select 1 from orders where id = p_order_id and created_at > now() - interval '1 day') then
      raise exception 'Order not found';
    end if;
    insert into push_subscriptions (endpoint, p256dh, auth, role, order_id, lang)
    values (p_endpoint, p_p256dh, p_auth, 'customer', p_order_id, v_lang)
    on conflict (endpoint, order_id) where role = 'customer'
    do update set p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang;

  else
    raise exception 'Unknown role';
  end if;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text, uuid, text) from public;
grant execute on function public.save_push_subscription(text, text, text, text, uuid, text) to anon, authenticated;

-- Old customer devices are only useful for a day.
delete from public.push_subscriptions where role = 'customer' and created_at < now() - interval '2 days';

notify pgrst, 'reload schema';
