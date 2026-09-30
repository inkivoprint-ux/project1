-- Recoverable order removal: retain records and private files in Trash.
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists deleted_at timestamptz;
update public.orders set completed_at = updated_at where state = 'completed' and completed_at is null;
create index if not exists orders_deleted_at_idx on public.orders (deleted_at) where deleted_at is not null;
