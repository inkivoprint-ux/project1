-- Independent, lifetime counters. Never reset on date changes or order deletion.
create table if not exists public.order_number_counters (
  channel text primary key check (channel in ('online', 'offline')),
  last_number numeric not null check (last_number >= 0 and last_number = trunc(last_number))
);
alter table public.order_number_counters enable row level security;
revoke all on public.order_number_counters from public, anon, authenticated;

create or replace function public.assign_order_number()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare channel_name text; sequence_number numeric;
begin
  channel_name := case when new.shipping_address->>'salesChannel' = 'offline' then 'offline' else 'online' end;
  insert into public.order_number_counters as counters(channel, last_number)
  values (channel_name, 1)
  on conflict (channel) do update set last_number = counters.last_number + 1
  returning last_number into sequence_number;
  new.order_number := case when channel_name = 'offline' then 'INKOFF' else 'INK' end
    || ' -' || to_char(coalesce(new.created_at, now()) at time zone 'Asia/Kolkata', 'DD/MM/YYYY')
    || ' -' || case when sequence_number < 10 then '0' else '' end || sequence_number::text;
  return new;
end;
$$;
revoke all on function public.assign_order_number() from public, anon, authenticated;
create or replace trigger assign_order_number before insert on public.orders
for each row execute function public.assign_order_number();
