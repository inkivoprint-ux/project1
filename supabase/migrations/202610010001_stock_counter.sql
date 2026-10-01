-- Product-wide stock is optional for existing products. null means not tracked.
-- Catalogue edits cannot overwrite stock counts changed by another checkout.
create or replace function public.preserve_catalogue_stock()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('inkivo.stock_write', true) is distinct from 'on' and old.storefront_config ? 'stockQuantity' then
    new.storefront_config := jsonb_set(coalesce(new.storefront_config, '{}'::jsonb), '{stockQuantity}', old.storefront_config->'stockQuantity');
  end if;
  return new;
end;
$$;
create trigger preserve_catalogue_stock before update of storefront_config on public.products
for each row execute function public.preserve_catalogue_stock();

create or replace function public.set_product_stock(product_slug text, quantity integer, expected_quantity integer)
returns void language plpgsql security invoker set search_path = public as $$
declare p public.products;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if quantity is not null and (quantity < 0 or quantity > 1000000) then raise exception 'Invalid stock quantity'; end if;
  perform pg_advisory_xact_lock(732491);
  select * into p from public.products where slug = product_slug for update;
  if p.id is null then raise exception 'Product not found'; end if;
  if (p.storefront_config->>'stockQuantity')::integer is distinct from expected_quantity then raise exception 'Stock changed. Refresh before updating.'; end if;
  perform set_config('inkivo.stock_write', 'on', true);
  update public.products set storefront_config = jsonb_set(coalesce(storefront_config, '{}'::jsonb), '{stockQuantity}', coalesce(to_jsonb(quantity), 'null'::jsonb)), updated_at = now() where id = p.id;
end;
$$;
revoke all on function public.set_product_stock(text, integer, integer) from public, anon;
grant execute on function public.set_product_stock(text, integer, integer) to authenticated;

-- Deduct only when the complete order has been saved successfully, once.
-- The lock and state update are transactional: concurrent sales cannot oversell.
create or replace function public.deduct_order_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare line record; available integer;
begin
  if new.state::text <> 'submitted' or old.state::text = 'submitted' or coalesce((old.shipping_address->>'stockDeducted')::boolean, false) then return new; end if;
  perform pg_advisory_xact_lock(732491);
  perform set_config('inkivo.stock_write', 'on', true);
  for line in select product_id, sum(quantity)::integer as quantity from public.order_items where order_id = new.id group by product_id order by product_id loop
    select (storefront_config->>'stockQuantity')::integer into available from public.products where id = line.product_id for update;
    if available is not null then
      if available < line.quantity then raise exception 'Insufficient stock. Refresh the product quantities before ordering.'; end if;
      update public.products set storefront_config = jsonb_set(storefront_config, '{stockQuantity}', to_jsonb(available - line.quantity)), updated_at = now() where id = line.product_id;
    end if;
  end loop;
  new.shipping_address := jsonb_set(new.shipping_address, '{stockDeducted}', 'true'::jsonb);
  return new;
end;
$$;
create trigger deduct_order_stock before update of state on public.orders
for each row execute function public.deduct_order_stock();

create or replace function public.submit_counter_order(document jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare order_uuid uuid; existing_uuid uuid; existing_hash text; entry jsonb; p public.products; qty integer; amount numeric := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  perform pg_advisory_xact_lock(732491);
  select id, request_hash into existing_uuid, existing_hash from public.orders where idempotency_key = 'counter-' || (document->>'idempotencyKey');
  if existing_uuid is not null then
    if existing_hash is distinct from md5(document::text) then raise exception 'This counter submission changed'; end if;
    return existing_uuid;
  end if;
  insert into public.orders(order_number, customer_name, phone, shipping_address, state, idempotency_key, request_hash)
  values ('POS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)), document->>'customerName', coalesce(document->>'phone', ''), jsonb_build_object('address', coalesce(document->>'address', 'Offline counter'), 'salesChannel', 'offline'), 'uploading', 'counter-' || (document->>'idempotencyKey'), md5(document::text)) returning id into order_uuid;
  for entry in select value from jsonb_array_elements(document->'items') loop
    select * into p from public.products where slug = entry->>'slug' and is_active for update;
    qty := (entry->>'quantity')::integer;
    if p.id is null or qty < 1 or qty > 99 then raise exception 'Invalid counter product or quantity'; end if;
    if (entry->>'unitPrice')::numeric is distinct from coalesce(p.offer_price, p.base_price) then raise exception 'Product price changed. Refresh the counter.'; end if;
    insert into public.order_items(order_id, product_id, product_name_snapshot, variant_snapshot, unit_price, quantity, line_total)
    values(order_uuid, p.id, p.name, jsonb_build_object('productId', p.storefront_config->>'id', 'size', entry->>'size'), coalesce(p.offer_price, p.base_price), qty, coalesce(p.offer_price, p.base_price) * qty);
    amount := amount + coalesce(p.offer_price, p.base_price) * qty;
  end loop;
  if amount <= 0 then raise exception 'Add products to the counter order'; end if;
  update public.orders set subtotal = amount, total = amount, state = 'submitted', updated_at = now() where id = order_uuid;
  return order_uuid;
end;
$$;
revoke all on function public.submit_counter_order(jsonb) from public, anon;
grant execute on function public.submit_counter_order(jsonb) to authenticated;
