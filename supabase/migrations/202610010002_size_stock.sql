-- Per-size stock is opt-in; existing product-wide counts remain until configured.
create or replace function public.preserve_catalogue_stock()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('inkivo.stock_write', true) is distinct from 'on' then
    new.storefront_config := coalesce(new.storefront_config, '{}'::jsonb) - 'stockQuantity' - 'sizeStock';
    if old.storefront_config ? 'stockQuantity' then new.storefront_config := jsonb_set(new.storefront_config, '{stockQuantity}', old.storefront_config->'stockQuantity'); end if;
    if old.storefront_config ? 'sizeStock' then new.storefront_config := jsonb_set(new.storefront_config, '{sizeStock}', old.storefront_config->'sizeStock'); end if;
  end if;
  return new;
end;
$$;
create or replace function public.set_product_size_stock(product_slug text, quantities jsonb, expected_quantities jsonb, expected_quantity integer)
returns void language plpgsql security invoker set search_path = public as $$
declare p public.products; size_key text; total_units integer := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if jsonb_typeof(quantities) <> 'object' or (select count(*) from jsonb_object_keys(quantities)) <> 6 then raise exception 'Invalid size stock'; end if;
  foreach size_key in array array['XS','S','M','L','XL','XXL'] loop
    if not (quantities ? size_key) or jsonb_typeof(quantities->size_key) <> 'number' or (quantities->>size_key) !~ '^[0-9]+$' or (quantities->>size_key)::integer > 1000000 then raise exception 'Invalid size stock'; end if;
    total_units := total_units + (quantities->>size_key)::integer;
  end loop;
  perform pg_advisory_xact_lock(732491);
  select * into p from public.products where slug = product_slug for update;
  if p.id is null or coalesce(p.storefront_config->>'category','') !~* '\mt[ -]?shirts?\M' then raise exception 'Choose a T-shirt product'; end if;
  if nullif(p.storefront_config->'sizeStock', 'null'::jsonb) is distinct from nullif(expected_quantities, 'null'::jsonb) or (p.storefront_config->>'stockQuantity')::integer is distinct from expected_quantity then raise exception 'Stock changed. Refresh before updating.'; end if;
  perform set_config('inkivo.stock_write', 'on', true);
  update public.products set storefront_config = jsonb_set(jsonb_set(storefront_config, '{sizeStock}', quantities), '{stockQuantity}', to_jsonb(total_units)), updated_at = now() where id = p.id;
end;
$$;
revoke all on function public.set_product_size_stock(text,jsonb,jsonb,integer) from public, anon;
grant execute on function public.set_product_size_stock(text,jsonb,jsonb,integer) to authenticated;

create or replace function public.set_product_stock(product_slug text, quantity integer, expected_quantity integer)
returns void language plpgsql security invoker set search_path = public as $$
declare p public.products;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if quantity is not null and (quantity < 0 or quantity > 1000000) then raise exception 'Invalid stock quantity'; end if;
  perform pg_advisory_xact_lock(732491);
  select * into p from public.products where slug = product_slug for update;
  if p.id is null then raise exception 'Product not found'; end if;
  if jsonb_typeof(p.storefront_config->'sizeStock') = 'object' then raise exception 'Update stock by size for this product'; end if;
  if (p.storefront_config->>'stockQuantity')::integer is distinct from expected_quantity then raise exception 'Stock changed. Refresh before updating.'; end if;
  perform set_config('inkivo.stock_write', 'on', true);
  update public.products set storefront_config = jsonb_set(coalesce(storefront_config, '{}'::jsonb), '{stockQuantity}', coalesce(to_jsonb(quantity), 'null'::jsonb)), updated_at = now() where id = p.id;
end;
$$;

create or replace function public.deduct_order_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare line record; size_line record; available integer; config jsonb; total_units integer;
begin
  if new.state::text <> 'submitted' or old.state::text = 'submitted' or coalesce((old.shipping_address->>'stockDeducted')::boolean, false) then return new; end if;
  perform pg_advisory_xact_lock(732491);
  perform set_config('inkivo.stock_write', 'on', true);
  for line in select product_id, sum(quantity)::integer as quantity from public.order_items where order_id = new.id group by product_id order by product_id loop
    select storefront_config into config from public.products where id = line.product_id for update;
    if jsonb_typeof(config->'sizeStock') = 'object' then
      for size_line in select variant_snapshot->>'size' as size, sum(quantity)::integer as quantity from public.order_items where order_id = new.id and product_id = line.product_id group by variant_snapshot->>'size' loop
        if size_line.size is null or size_line.size not in ('XS','S','M','L','XL','XXL') then raise exception 'Choose a valid T-shirt size'; end if;
        available := (config->'sizeStock'->>size_line.size)::integer;
        if available is null or available < size_line.quantity then raise exception 'Insufficient stock for size %. Refresh before ordering.', size_line.size; end if;
        config := jsonb_set(config, array['sizeStock', size_line.size], to_jsonb(available - size_line.quantity));
      end loop;
      select sum(value::integer) into total_units from jsonb_each_text(config->'sizeStock');
      config := jsonb_set(config, '{stockQuantity}', to_jsonb(total_units));
      update public.products set storefront_config = config, updated_at = now() where id = line.product_id;
    else
      available := (config->>'stockQuantity')::integer;
      if available is not null then
        if available < line.quantity then raise exception 'Insufficient stock. Refresh the product quantities before ordering.'; end if;
        update public.products set storefront_config = jsonb_set(config, '{stockQuantity}', to_jsonb(available - line.quantity)), updated_at = now() where id = line.product_id;
      end if;
    end if;
  end loop;
  new.shipping_address := jsonb_set(new.shipping_address, '{stockDeducted}', 'true'::jsonb);
  return new;
end;
$$;
