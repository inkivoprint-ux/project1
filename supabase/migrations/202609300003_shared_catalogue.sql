-- Additive shared storefront documents; existing order/capture tables are unchanged.
alter table public.products add column if not exists storefront_config jsonb;
grant select on public.products, public.categories to anon, authenticated;
grant insert, update, delete on public.products, public.categories to authenticated;

create table public.storefront_templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  status text not null check (status in ('draft', 'published', 'retired')),
  version integer not null check (version > 0),
  config jsonb not null,
  updated_at timestamptz not null default now()
);
create unique index storefront_templates_current_idx on public.storefront_templates(product_id, status) where status <> 'retired';
alter table public.storefront_templates enable row level security;
create policy "customers read published storefront templates" on public.storefront_templates for select
  using (status = 'published' and exists(select 1 from public.products p where p.id = product_id and p.is_active));
create policy "admins manage storefront templates" on public.storefront_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.storefront_templates to anon, authenticated;
grant insert, update, delete on public.storefront_templates to authenticated;

-- Catalogue edits and position shifts are one transaction, not separate partial writes.
create or replace function public.save_storefront_product(document jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare category_uuid uuid; product_uuid uuid; requested_position integer; slot integer := 0; entry record;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  perform pg_advisory_xact_lock(732491);
  requested_position := greatest(1, (document->>'displayOrder')::integer);
  insert into public.categories(name, slug) values(document->>'category', lower(regexp_replace(document->>'category', '[^a-zA-Z0-9]+', '-', 'g')))
    on conflict(slug) do update set name = excluded.name returning id into category_uuid;
  if exists(select 1 from public.products where slug = document->>'slug' and storefront_config is not null and storefront_config->>'id' <> document->>'id') then
    raise exception 'Product identity cannot be changed';
  end if;
  insert into public.products(category_id, name, slug, description, base_price, offer_price, is_active, storefront_config)
    values(category_uuid, document->>'name', document->>'slug', document->>'description',
      coalesce((document->>'compareAt')::numeric, (document->>'price')::numeric),
      case when document ? 'compareAt' then (document->>'price')::numeric else null end, true, document)
    on conflict(slug) do update set category_id = excluded.category_id, name = excluded.name, description = excluded.description,
      base_price = excluded.base_price, offer_price = excluded.offer_price, storefront_config = excluded.storefront_config, updated_at = now()
    returning id into product_uuid;
  requested_position := least(requested_position, (select count(*) from public.products where is_active));
  for entry in select id from public.products where is_active and id <> product_uuid
    order by coalesce((storefront_config->>'displayOrder')::integer, 10000), created_at, id loop
    slot := slot + 1;
    if slot = requested_position then slot := slot + 1; end if;
    update public.products set storefront_config = jsonb_set(storefront_config, '{displayOrder}', to_jsonb(slot)), updated_at = now() where id = entry.id;
  end loop;
  update public.products set storefront_config = jsonb_set(storefront_config, '{displayOrder}', to_jsonb(requested_position)), updated_at = now() where id = product_uuid;
end;
$$;
revoke all on function public.save_storefront_product(jsonb) from public, anon;
grant execute on function public.save_storefront_product(jsonb) to authenticated;

create or replace function public.save_storefront_template(product_slug text, document jsonb, publish boolean)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare product_uuid uuid; next_version integer; result jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select id into product_uuid from public.products where slug = product_slug for update;
  if product_uuid is null then raise exception 'Product not found'; end if;
  select coalesce(max(version), 0) + 1 into next_version from public.storefront_templates where product_id = product_uuid;
  result := jsonb_set(jsonb_set(jsonb_set(document, '{version}', to_jsonb(next_version)), '{status}', to_jsonb(case when publish then 'published'::text else 'draft'::text end)), '{updatedAt}', to_jsonb(now()));
  if publish then
    update public.storefront_templates set status = 'retired', updated_at = now() where product_id = product_uuid and status = 'published';
    insert into public.storefront_templates(product_id, status, version, config) values(product_uuid, 'published', next_version, result);
  end if;
  insert into public.storefront_templates(product_id, status, version, config) values(product_uuid, 'draft', next_version, result)
    on conflict(product_id, status) where status <> 'retired' do update set version = excluded.version, config = excluded.config, updated_at = now();
  return result;
end;
$$;
revoke all on function public.save_storefront_template(text, jsonb, boolean) from public, anon;
grant execute on function public.save_storefront_template(text, jsonb, boolean) to authenticated;
