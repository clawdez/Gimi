-- Gimi Redbox build: isolated `gimi` schema in the shared recco Supabase project.
-- Additive only — never drops or alters other schemas (cardpick precedent).

create schema if not exists gimi;

create table if not exists gimi.items (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  brand text not null,
  model text not null default '',
  condition int not null default 7,
  description text not null default '',
  image_url text not null default '',
  daily_rate numeric not null,
  retail_price numeric not null default 0,
  overage_multiplier numeric not null default 1.5,
  status text not null default 'available' check (status in ('available', 'rented', 'overdue')),
  owner text not null default '',
  renter text,
  rental_start timestamptz,
  rental_days int,
  category text not null,
  trust_score int not null default 50,
  created_at timestamptz not null default now()
);

create table if not exists gimi.rentals (
  id text primary key default gen_random_uuid()::text,
  item_id text not null references gimi.items(id),
  renter text not null,
  rental_days int not null,
  daily_rate numeric not null,
  amount_usd numeric not null,
  status text not null default 'active' check (status in ('active', 'returned', 'returned_late')),
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_payment_status text,
  overage_payment_intent_id text,
  overage_amount_usd numeric,
  rental_start timestamptz not null default now(),
  returned_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists gimi.receipts (
  id text primary key default gen_random_uuid()::text,
  rental_id text not null references gimi.rentals(id),
  memo_hash text not null,
  tx_signature text not null,
  explorer_url text not null,
  cluster text not null default 'devnet',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS: items world-readable; rentals/receipts service-role only (no policies = deny).
alter table gimi.items enable row level security;
alter table gimi.rentals enable row level security;
alter table gimi.receipts enable row level security;

drop policy if exists items_world_read on gimi.items;
create policy items_world_read on gimi.items for select using (true);

grant usage on schema gimi to anon, authenticated, service_role;
grant select on gimi.items to anon, authenticated;
grant all on all tables in schema gimi to service_role;
alter default privileges in schema gimi grant all on tables to service_role;

-- Seed the 5 existing sample items (idempotent).
insert into gimi.items
  (id, name, brand, model, condition, description, image_url, daily_rate, retail_price, overage_multiplier, status, owner, renter, rental_start, rental_days, category, trust_score, created_at)
values
  ('1', 'Callaway Rogue ST Max Irons', 'Callaway', 'Rogue ST Max', 7,
   'Full iron set (5-PW). Some scuffs on club heads but grips are solid. Great for weekend rounds.',
   'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=400&h=300&fit=crop',
   20, 1800, 1.5, 'available', '7xKX...m3Qp', null, null, null, 'Sports', 92, now() - interval '3 days'),
  ('2', 'DeWalt 20V MAX Drill Kit', 'DeWalt', 'DCD771C2', 8,
   'Barely used drill with 2 batteries and charger. Perfect for home projects.',
   'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=300&fit=crop',
   8, 149, 1.5, 'available', '3kPQ...x9Rv', null, null, null, 'Tools', 88, now() - interval '1 day'),
  ('3', 'Sony A7 III Camera Body', 'Sony', 'A7 III (ILCE-7M3)', 9,
   'Excellent condition, low shutter count (~5k). Body only — bring your own lens.',
   'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=300&fit=crop',
   45, 1999, 2.0, 'available', '9mNB...w2Lk', null, null, null, 'Electronics', 95, now() - interval '5 days'),
  ('4', 'KitchenAid Stand Mixer', 'KitchenAid', 'Artisan 5-Quart', 8,
   'Empire Red, comes with flat beater, dough hook, and wire whip. Used a handful of times.',
   'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400&h=300&fit=crop',
   12, 449, 1.5, 'rented', '5jRT...k8Wp', '2nVX...p4Qs', now() - interval '2 days', 5, 'Kitchen', 90, now() - interval '7 days'),
  ('5', 'Louis Vuitton Keepall 55', 'Louis Vuitton', 'Keepall Bandoulière 55', 9,
   'Monogram canvas, excellent condition. Perfect for a weekend trip or event.',
   'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=300&fit=crop',
   35, 2260, 2.0, 'available', '8pFG...n1Yk', null, null, null, 'Luxury', 97, now() - interval '2 days')
on conflict (id) do nothing;
