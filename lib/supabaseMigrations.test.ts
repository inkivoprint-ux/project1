import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { products } from "./products";
import { createDefaultTemplate } from "./customization";

// Real PostgreSQL engine, isolated in memory. Minimal external Supabase schemas
// provide migration dependencies; this is not a live Auth/Storage service test.
let db: PGlite;
const adminId = "10000000-0000-4000-8000-000000000001";
const customerId = "10000000-0000-4000-8000-000000000002";
async function role(name: "authenticated" | "anon" | "service_role", user = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec(`set role ${name}`);
}
beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean);
    create table storage.objects(id uuid primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:cardinality(string_to_array(name, '/'))-1] $$;
  `);
  for (const name of ["202609290001_initial_schema.sql", "202609300001_admin_profile_access.sql", "202609300002_order_management.sql", "202609300003_shared_catalogue.sql", "202609300004_order_safety.sql", "202610010001_stock_counter.sql", "202610010002_size_stock.sql"]) await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [adminId, customerId]);
  await db.query("update public.profiles set role='admin' where id=$1", [adminId]);
  await role("authenticated", adminId);
  await db.query("select public.save_storefront_product($1::jsonb)", [JSON.stringify({ ...products[0], displayOrder: 1 })]);
}, 30_000);
afterEach(async () => { await db.exec("reset role"); });
afterAll(async () => { await db?.close(); });

describe("actual migration SQL and permission boundaries", () => {
  it("applies every migration and enables RLS on the new tables", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relname in ('storefront_templates','order_submission_limits')");
    expect(result.rows).toHaveLength(2); expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });
  it("rejects ordinary users and anonymous catalogue/template mutations", async () => {
    await role("authenticated", customerId);
    await expect(db.query("select public.save_storefront_product($1::jsonb)", [JSON.stringify(products[1])])).rejects.toThrow("Administrator access required");
    await expect(db.query("select public.save_storefront_template($1, $2::jsonb, true)", [products[0].slug, JSON.stringify(createDefaultTemplate(products[0]))])).rejects.toThrow("Administrator access required");
    await role("anon");
    await expect(db.query("select public.save_storefront_product($1::jsonb)", [JSON.stringify(products[1])])).rejects.toThrow("permission denied");
  });
  it("saves authoritative prices and shifts positions atomically", async () => {
    await role("authenticated", adminId);
    await db.query("select public.save_storefront_product($1::jsonb)", [JSON.stringify({ ...products[1], displayOrder: 1 })]);
    const result = await db.query<{ slug: string; price: string; position: string }>("select slug, coalesce(offer_price,base_price)::text as price, storefront_config->>'displayOrder' as position from public.products order by (storefront_config->>'displayOrder')::int");
    expect(result.rows.map((row) => row.slug)).toEqual([products[1].slug, products[0].slug]);
    expect(result.rows.map((row) => row.position)).toEqual(["1", "2"]);
    expect(Number(result.rows[0].price)).toBe(products[1].price);
    await expect(db.query("select public.save_storefront_product($1::jsonb)", [JSON.stringify({ ...products[1], id: "changed-identity", displayOrder: 2 })])).rejects.toThrow("identity cannot be changed");
  });
  it("keeps drafts and retired versions hidden while publishing one customer version", async () => {
    await role("authenticated", adminId);
    const template = createDefaultTemplate(products[0]);
    const published = await db.query<{ config: { version: number } }>("select public.save_storefront_template($1, $2::jsonb, true) as config", [products[0].slug, JSON.stringify(template)]);
    await db.query("select public.save_storefront_template($1, $2::jsonb, false)", [products[0].slug, JSON.stringify({ ...template, area: { ...template.area, opacity: .2 } })]);
    await role("anon");
    const visible = await db.query<{ status: string; config: { version: number; area: { opacity: number } } }>("select status, config from public.storefront_templates");
    expect(visible.rows).toHaveLength(1); expect(visible.rows[0].status).toBe("published");
    expect(visible.rows[0].config.version).toBe(published.rows[0].config.version);
    expect(visible.rows[0].config.area.opacity).toBe(template.area.opacity);
    await role("authenticated", adminId);
    await db.query("select public.save_storefront_template($1, $2::jsonb, true)", [products[0].slug, JSON.stringify(template)]);
    await role("anon"); expect((await db.query("select status from public.storefront_templates")).rows).toEqual([{ status: "published" }]);
  });
  it("prevents customers from promoting themselves or reading another profile", async () => {
    await role("authenticated", customerId);
    expect((await db.query("update public.profiles set role='admin' where id=auth.uid() returning id")).rows).toEqual([]);
    expect((await db.query("select public.is_admin() as admin")).rows).toEqual([{ admin: false }]);
    expect((await db.query("select id from public.profiles where id<>auth.uid()")).rows).toEqual([]);
  });
  it("limits attempts in PostgreSQL and restricts the limiter to the server role", async () => {
    await role("anon"); await expect(db.query("select public.consume_order_attempt('fixture')")).rejects.toThrow("permission denied");
    await role("service_role");
    for (let index = 0; index < 8; index++) expect((await db.query("select public.consume_order_attempt('fixture') as allowed")).rows).toEqual([{ allowed: true }]);
    expect((await db.query("select public.consume_order_attempt('fixture') as allowed")).rows).toEqual([{ allowed: false }]);
    await db.exec("reset role");
    await db.exec("update public.order_submission_limits set window_started = now() - interval '11 minutes'");
    await role("service_role"); expect((await db.query("select public.consume_order_attempt('fixture') as allowed")).rows).toEqual([{ allowed: true }]);
  });
});

describe("inventory and transactional offline sales", () => {
  const product = products[0];
  const body = (key: string, quantity = 1) => ({ idempotencyKey: key, customerName: "Counter customer", phone: "", address: "Counter", items: [{ slug: product.slug, quantity, unitPrice: product.price }] });
  const stock = async () => (await db.query<{ quantity: number }>("select (storefront_config->>'stockQuantity')::integer as quantity from public.products where slug=$1", [product.slug])).rows[0].quantity;
  it("deducts a counter sale exactly once and preserves stock on catalogue edits", async () => {
    await role("authenticated", adminId);
    await db.query("select public.set_product_stock($1, 5, null)", [product.slug]);
    const document = body("stock-counter-one", 2);
    const first = await db.query<{ id: string }>("select public.submit_counter_order($1::jsonb) as id", [JSON.stringify(document)]);
    expect(await stock()).toBe(3);
    const retry = await db.query<{ id: string }>("select public.submit_counter_order($1::jsonb) as id", [JSON.stringify(document)]);
    expect(retry.rows).toEqual(first.rows); expect(await stock()).toBe(3);
    await db.query("select public.save_storefront_product($1::jsonb)", [JSON.stringify({ ...product, stockQuantity: 99, displayOrder: 1 })]);
    expect(await stock()).toBe(3);
    await db.query("update public.orders set state='completed', completed_at=now(), deleted_at=now() where id=$1", [first.rows[0].id]);
    await db.query("delete from public.orders where id=$1", [first.rows[0].id]);
    expect(await stock()).toBe(3);
  });
  it("rejects overselling and rolls back the entire multi-product order", async () => {
    await role("authenticated", adminId);
    await expect(db.query("select public.submit_counter_order($1::jsonb)", [JSON.stringify(body("stock-counter-over", 4))])).rejects.toThrow("Insufficient stock");
    expect(await stock()).toBe(3);
    expect((await db.query("select id from public.orders where idempotency_key='counter-stock-counter-over'")).rows).toEqual([]);
  });
  it("rejects stale inventory writes and changed retry payloads", async () => {
    await role("authenticated", adminId);
    await expect(db.query("select public.set_product_stock($1, 10, 5)", [product.slug])).rejects.toThrow("Stock changed");
    await db.query("select public.submit_counter_order($1::jsonb)", [JSON.stringify(body("stock-counter-retry"))]);
    await expect(db.query("select public.submit_counter_order($1::jsonb)", [JSON.stringify(body("stock-counter-retry", 2))])).rejects.toThrow("submission changed");
    expect(await stock()).toBe(2);
  });
  it("deducts online stock on final submission, aggregates duplicate size lines, and skips reopen", async () => {
    await role("authenticated", adminId);
    const row = await db.query<{ id: string }>("insert into public.orders(order_number,customer_name,phone,shipping_address,state,idempotency_key) values('ONLINE-STOCK','Customer','','{}','uploading','online-stock') returning id");
    const id = row.rows[0].id;
    await db.query("insert into public.order_items(order_id,product_id,product_name_snapshot,unit_price,quantity,line_total) select $1,id,name,1,1,1 from public.products where slug=$2", [id,product.slug]);
    expect(await stock()).toBe(2);
    await db.query("update public.orders set state='submitted' where id=$1", [id]); expect(await stock()).toBe(1);
    await db.query("update public.orders set state='completed' where id=$1", [id]);
    await db.query("update public.orders set state='submitted' where id=$1", [id]); expect(await stock()).toBe(1);
  });
  it("denies stock and counter functions to customers and anonymous visitors", async () => {
    await role("authenticated", customerId);
    await expect(db.query("select public.set_product_stock($1, 9, 1)",[product.slug])).rejects.toThrow("Administrator access required");
    await expect(db.query("select public.submit_counter_order($1::jsonb)",[JSON.stringify(body("forbidden"))])).rejects.toThrow("Administrator access required");
    await role("anon"); await expect(db.query("select public.set_product_stock($1, 9, 1)",[product.slug])).rejects.toThrow("permission denied");
  });
});

it("deducts exact size stock, preserves other sizes, and rolls back unavailable sizes", async () => {
  await role("authenticated", adminId);
  const shirt = products[3];
  await db.query("select public.save_storefront_product($1::jsonb)", [JSON.stringify(shirt)]);
  const counts = { XS: 2, S: 3, M: 4, L: 5, XL: 6, XXL: 7 };
  await db.query("select public.set_product_size_stock($1,$2::jsonb,null,null)", [shirt.slug, JSON.stringify(counts)]);
  const document = { idempotencyKey: "size-sale", customerName: "Test", items: [{ slug: shirt.slug, quantity: 2, unitPrice: shirt.price, size: "XXL" }, { slug: shirt.slug, quantity: 1, unitPrice: shirt.price, size: "XS" }] };
  await db.query("select public.submit_counter_order($1::jsonb)", [JSON.stringify(document)]);
  const config = async () => (await db.query<{ config: { sizeStock: typeof counts; stockQuantity: number } }>("select storefront_config as config from public.products where slug=$1", [shirt.slug])).rows[0].config;
  expect((await config()).sizeStock).toEqual({ ...counts, XS: 1, XXL: 5 });
  expect((await config()).stockQuantity).toBe(24);
  await db.query("select public.submit_counter_order($1::jsonb)", [JSON.stringify(document)]);
  expect((await config()).stockQuantity).toBe(24);
  await expect(db.query("select public.submit_counter_order($1::jsonb)", [JSON.stringify({ ...document, idempotencyKey: "size-oversell", items: [{ ...document.items[0], size: "XS", quantity: 2 }] })])).rejects.toThrow("Insufficient stock for size XS");
  expect((await config()).stockQuantity).toBe(24);
  await db.query("select public.save_storefront_product($1::jsonb)", [JSON.stringify({ ...shirt, sizeStock: counts, stockQuantity: 99 })]);
  expect((await config()).sizeStock.XS).toBe(1);
  await expect(db.query("select public.set_product_size_stock($1,$2::jsonb,$3::jsonb,24)", [shirt.slug, JSON.stringify(counts), JSON.stringify(counts)])).rejects.toThrow("Stock changed");
});
