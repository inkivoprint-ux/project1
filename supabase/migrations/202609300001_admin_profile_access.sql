-- Authenticated users may read their own role, but cannot grant themselves admin.
create policy "users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create or replace function public.create_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'customer', new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users for each row execute function public.create_user_profile();

insert into public.profiles (id, role)
select id, 'customer' from auth.users
on conflict (id) do nothing;
