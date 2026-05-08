-- ============================================================
-- Shop Builder – Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Stores
create table if not exists stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  whatsapp    text not null,
  category    text,
  location    text,
  created_at  timestamptz not null default now()
);

-- Products
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  name        text not null,
  price       numeric(12,2) not null,
  description text,
  image_url   text,
  category    text,
  units       integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Product Variants (e.g. Size: S/M/L, Colour: Red/Blue)
create table if not exists product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  label       text not null,
  values      text[] not null default '{}'
);

-- Reviews
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  name        text not null,
  rating      integer not null check (rating between 1 and 5),
  comment     text not null,
  created_at  timestamptz not null default now()
);

-- Product click analytics
create table if not exists product_clicks (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  store_id    uuid not null references stores(id) on delete cascade,
  clicked_at  timestamptz not null default now()
);

-- ============================================================
-- Row Level Security (disable for service-role key usage)
-- ============================================================
alter table stores         disable row level security;
alter table products       disable row level security;
alter table product_variants disable row level security;
alter table reviews        disable row level security;
alter table product_clicks disable row level security;

-- ============================================================
-- Indexes for performance
-- ============================================================
create index if not exists idx_products_store_id       on products(store_id);
create index if not exists idx_product_variants_pid    on product_variants(product_id);
create index if not exists idx_reviews_product_id      on reviews(product_id);
create index if not exists idx_clicks_store_id         on product_clicks(store_id);
create index if not exists idx_clicks_product_id       on product_clicks(product_id);
