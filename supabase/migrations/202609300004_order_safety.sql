alter table public.orders add column if not exists request_hash text;
create table public.order_submission_limits (
  identifier text primary key,
  window_started timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.order_submission_limits enable row level security;
revoke all on public.order_submission_limits from anon, authenticated;
create or replace function public.consume_order_attempt(identifier_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare attempt_count integer;
begin
  insert into public.order_submission_limits(identifier) values(identifier_hash)
  on conflict(identifier) do update set
    attempts = case when order_submission_limits.window_started < now() - interval '10 minutes' then 1 else order_submission_limits.attempts + 1 end,
    window_started = case when order_submission_limits.window_started < now() - interval '10 minutes' then now() else order_submission_limits.window_started end
  returning attempts into attempt_count;
  delete from public.order_submission_limits where window_started < now() - interval '1 day';
  return attempt_count <= 8;
end;
$$;
revoke all on function public.consume_order_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_order_attempt(text) to service_role;
