create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'admin');
create type public.order_state as enum ('draft', 'uploading', 'processing', 'submitted', 'failed', 'confirmed', 'design_review', 'printing', 'ready', 'completed', 'cancelled');
create type public.file_kind as enum ('original', 'edited', 'print_ready', 'preview');
create type public.surface_type as enum ('flat', 'perspective', 'cylinder', 'tapered_cylinder', 'custom_mask', 'fabric', 'three_d');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text,
  phone text,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  base_price numeric(12,2) not null check (base_price >= 0),
  offer_price numeric(12,2) check (offer_price is null or offer_price >= 0),
  is_active boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  name text not null,
  color text,
  size text,
  price_delta numeric(12,2) not null default 0,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  asset_type text not null check (asset_type in ('original', 'mockup', 'mask', 'overlay', 'web_preview')),
  storage_path text not null,
  mime_type text not null,
  width integer,
  height integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.customization_templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  version integer not null check (version > 0),
  name text not null,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  allowed_tools jsonb not null default '{"images":1,"text":false}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(product_id, variant_id, version)
);

create table public.customization_areas (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.customization_templates(id) on delete cascade,
  name text not null,
  surface_type public.surface_type not null,
  width_mm numeric(10,3) not null check (width_mm > 0),
  height_mm numeric(10,3) not null check (height_mm > 0),
  target_dpi integer not null default 300 check (target_dpi between 72 and 1200),
  bleed_mm numeric(10,3) not null default 0,
  safe_margin_mm numeric(10,3) not null default 0,
  renderer_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.template_layers (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.customization_areas(id) on delete cascade,
  layer_type text not null check (layer_type in ('placeholder','mask','shadow','highlight','texture')),
  name text not null,
  asset_id uuid references public.product_assets(id) on delete set null,
  transform jsonb not null default '{}'::jsonb,
  blend_mode text,
  opacity numeric(4,3) not null default 1 check (opacity between 0 and 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.profiles(id) on delete set null,
  guest_email text,
  customer_name text not null,
  phone text not null,
  whatsapp text,
  shipping_address jsonb not null,
  notes text,
  state public.order_state not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  idempotency_key text not null unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  variant_snapshot jsonb not null default '{}'::jsonb,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table public.order_customizations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  template_id uuid not null references public.customization_templates(id) on delete restrict,
  area_id uuid not null references public.customization_areas(id) on delete restrict,
  editable_state jsonb not null,
  created_at timestamptz not null default now()
);

create table public.generated_files (
  id uuid primary key default gen_random_uuid(),
  customization_id uuid not null references public.order_customizations(id) on delete cascade,
  kind public.file_kind not null,
  storage_path text not null,
  original_filename text,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  width integer,
  height integer,
  sha256 text,
  created_at timestamptz not null default now(),
  unique(customization_id, kind, storage_path)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  state public.order_state not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index products_category_idx on public.products(category_id) where is_active;
create index variants_product_idx on public.product_variants(product_id) where is_active;
create index templates_product_idx on public.customization_templates(product_id, status);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_state_created_idx on public.orders(state, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index generated_files_customization_idx on public.generated_files(customization_id, kind);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_assets enable row level security;
alter table public.customization_templates enable row level security;
alter table public.customization_areas enable row level security;
alter table public.template_layers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_customizations enable row level security;
alter table public.generated_files enable row level security;
alter table public.order_status_history enable row level security;

create policy "public reads active categories" on public.categories for select using (is_active or public.is_admin());
create policy "public reads active products" on public.products for select using (is_active or public.is_admin());
create policy "public reads active variants" on public.product_variants for select using (is_active or public.is_admin());
create policy "admins manage catalog" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage variants" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage assets" on public.product_assets for all using (public.is_admin()) with check (public.is_admin());
create policy "published templates readable" on public.customization_templates for select using (status = 'published' or public.is_admin());
create policy "published areas readable" on public.customization_areas for select using (exists(select 1 from public.customization_templates t where t.id = template_id and t.status = 'published') or public.is_admin());
create policy "published layers readable" on public.template_layers for select using (exists(select 1 from public.customization_areas a join public.customization_templates t on t.id = a.template_id where a.id = area_id and t.status = 'published') or public.is_admin());
create policy "admins manage templates" on public.customization_templates for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage areas" on public.customization_areas for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage layers" on public.template_layers for all using (public.is_admin()) with check (public.is_admin());
create policy "users read own orders" on public.orders for select using (customer_id = auth.uid() or public.is_admin());
create policy "users read own order items" on public.order_items for select using (exists(select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_admin())));
create policy "users read own customizations" on public.order_customizations for select using (exists(select 1 from public.order_items i join public.orders o on o.id = i.order_id where i.id = order_item_id and (o.customer_id = auth.uid() or public.is_admin())));
create policy "users read own generated files" on public.generated_files for select using (exists(select 1 from public.order_customizations c join public.order_items i on i.id = c.order_item_id join public.orders o on o.id = i.order_id where c.id = customization_id and (o.customer_id = auth.uid() or public.is_admin())));
create policy "admins manage orders" on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage order items" on public.order_items for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage customizations" on public.order_customizations for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage generated files" on public.generated_files for all using (public.is_admin()) with check (public.is_admin());
create policy "users read own status history" on public.order_status_history for select using (exists(select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_admin())));
create policy "admins manage status history" on public.order_status_history for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('product-assets', 'product-assets', true), ('order-assets', 'order-assets', false) on conflict (id) do nothing;
create policy "public reads product assets" on storage.objects for select using (bucket_id = 'product-assets');
create policy "admins manage product assets" on storage.objects for all using (bucket_id = 'product-assets' and public.is_admin()) with check (bucket_id = 'product-assets' and public.is_admin());
create policy "order owners read private files" on storage.objects for select using (bucket_id = 'order-assets' and (public.is_admin() or exists(select 1 from public.orders o where o.customer_id = auth.uid() and (storage.foldername(name))[2] = o.id::text)));
