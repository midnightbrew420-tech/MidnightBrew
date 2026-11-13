-- =====================================================================
-- Shop open / closed switch.
--   Staff flip it on the staff page; customers see "We're closed" and
--   can't order while it is closed. Orders added by staff still work.
-- Safe to re-run.
-- =====================================================================

create table if not exists public.shop_status (
  id         int primary key default 1 check (id = 1),   -- always a single row
  is_open    boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.shop_status (id, is_open) values (1, true) on conflict (id) do nothing;

alter table public.shop_status enable row level security;

drop policy if exists "shop status readable by all" on public.shop_status;
create policy "shop status readable by all" on public.shop_status
  for select using (true);

drop policy if exists "staff update shop status" on public.shop_status;
create policy "staff update shop status" on public.shop_status
  for update to authenticated using (true) with check (true);

-- Block new customer orders while the shop is closed (even from a menu page left open).
create or replace function public.block_orders_when_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'customer' and exists (select 1 from shop_status where id = 1 and not is_open) then
    raise exception 'Sorry, we are closed right now. Please order again when we open.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_only_when_open on public.orders;
create trigger orders_only_when_open
  before insert on public.orders
  for each row execute function public.block_orders_when_closed();

-- Live updates, so open menus switch to "closed" the moment staff press the button.
do $$
begin
  alter publication supabase_realtime add table public.shop_status;
exception when duplicate_object then null;
end $$;
