-- CRIB initial schema + security
create extension if not exists pgcrypto;

create type public.asset_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.wallet_tx_type as enum ('credit', 'debit');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  bio text,
  avatar_url text,
  niche text,
  socials jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null,
  tags text[] not null default '{}'::text[],
  price_kobo integer not null check (price_kobo >= 0),
  currency text not null default 'GHS' check (char_length(currency) between 3 and 6),
  status public.asset_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.asset_files (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  storage_path text not null unique,
  file_type text not null,
  file_size bigint not null check (file_size >= 0),
  original_name text not null,
  created_at timestamptz not null default now()
);

create table public.asset_previews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  preview_url text not null,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.profiles (id) on delete set null,
  email text not null,
  email_token uuid not null default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete restrict,
  amount_kobo integer not null check (amount_kobo >= 0),
  currency text not null default 'GHS' check (char_length(currency) between 3 and 6),
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  reference text not null unique,
  status public.payment_status not null default 'pending',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create table public.wallet (
  creator_id uuid primary key references public.profiles (id) on delete cascade,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_tx (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  type public.wallet_tx_type not null,
  amount_kobo integer not null check (amount_kobo > 0),
  created_at timestamptz not null default now(),
  unique (order_id, type)
);

create index assets_category_idx on public.assets (category);
create index assets_tags_gin_idx on public.assets using gin (tags);
create index assets_price_idx on public.assets (price_kobo);
create index assets_created_at_idx on public.assets (created_at desc);
create index assets_status_idx on public.assets (status);
create index assets_creator_idx on public.assets (creator_id);

create index asset_files_asset_id_idx on public.asset_files (asset_id);
create index asset_previews_asset_id_idx on public.asset_previews (asset_id);

create index orders_buyer_idx on public.orders (buyer_id);
create index orders_asset_idx on public.orders (asset_id);
create unique index orders_email_token_idx on public.orders (email_token);
create index orders_status_idx on public.orders (status);

create index payments_status_idx on public.payments (status);
create index wallet_tx_creator_idx on public.wallet_tx (creator_id);
create index wallet_tx_order_idx on public.wallet_tx (order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_assets_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger set_wallet_updated_at
before update on public.wallet
for each row execute function public.set_updated_at();

create or replace function public.request_order_token()
returns text
language sql
stable
as $$
  select coalesce((coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-order-token'), '');
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_name text;
begin
  fallback_name := split_part(new.email, '@', 1);

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', fallback_name),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.wallet (creator_id, balance_kobo)
  values (new.id, 0)
  on conflict (creator_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

create or replace function public.credit_wallet(
  p_creator_id uuid,
  p_order_id uuid,
  p_amount_kobo integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if p_amount_kobo <= 0 then
    return false;
  end if;

  insert into public.wallet_tx (creator_id, order_id, type, amount_kobo)
  values (p_creator_id, p_order_id, 'credit', p_amount_kobo)
  on conflict (order_id, type) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    return false;
  end if;

  insert into public.wallet (creator_id, balance_kobo)
  values (p_creator_id, p_amount_kobo)
  on conflict (creator_id)
  do update set
    balance_kobo = public.wallet.balance_kobo + excluded.balance_kobo,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.credit_wallet(uuid, uuid, integer) from public;
grant execute on function public.credit_wallet(uuid, uuid, integer) to service_role;

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.assets enable row level security;
alter table public.asset_files enable row level security;
alter table public.asset_previews enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.wallet enable row level security;
alter table public.wallet_tx enable row level security;

create policy "profiles are publicly readable"
on public.profiles
for select
using (true);

create policy "users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can view own admin record"
on public.admins
for select
using (user_id = auth.uid());

create policy "published assets are public"
on public.assets
for select
using (status = 'published');

create policy "creators can read own assets"
on public.assets
for select
using (creator_id = auth.uid());

create policy "creators can insert own assets"
on public.assets
for insert
with check (creator_id = auth.uid());

create policy "creators can update own assets"
on public.assets
for update
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

create policy "creators can delete own assets"
on public.assets
for delete
using (creator_id = auth.uid());

create policy "admins can moderate assets"
on public.assets
for all
using (exists (select 1 from public.admins ad where ad.user_id = auth.uid()))
with check (exists (select 1 from public.admins ad where ad.user_id = auth.uid()));

create policy "asset previews are public"
on public.asset_previews
for select
using (true);

create policy "creators can insert previews for own assets"
on public.asset_previews
for insert
with check (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

create policy "creators can update previews for own assets"
on public.asset_previews
for update
using (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

create policy "creators can delete previews for own assets"
on public.asset_previews
for delete
using (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

create policy "creators can insert files for own assets"
on public.asset_files
for insert
with check (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

create policy "creators and paid buyers can read asset files"
on public.asset_files
for select
using (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
  or exists (
    select 1
    from public.orders o
    where o.asset_id = asset_files.asset_id
      and o.status = 'paid'
      and (
        o.buyer_id = auth.uid()
        or o.email = (auth.jwt() ->> 'email')
        or (public.request_order_token() <> '' and o.email_token::text = public.request_order_token())
      )
  )
);

create policy "creators can update own files"
on public.asset_files
for update
using (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

create policy "creators can delete own files"
on public.asset_files
for delete
using (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

create policy "buyers creators and admins can read orders"
on public.orders
for select
using (
  buyer_id = auth.uid()
  or email = (auth.jwt() ->> 'email')
  or (
    public.request_order_token() <> ''
    and email_token::text = public.request_order_token()
  )
  or exists (
    select 1
    from public.assets a
    where a.id = orders.asset_id
      and a.creator_id = auth.uid()
  )
  or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
);

create policy "buyers creators and admins can read payments"
on public.payments
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and (
        o.buyer_id = auth.uid()
        or o.email = (auth.jwt() ->> 'email')
        or (public.request_order_token() <> '' and o.email_token::text = public.request_order_token())
      )
  )
  or exists (
    select 1
    from public.orders o
    join public.assets a on a.id = o.asset_id
    where o.id = payments.order_id
      and a.creator_id = auth.uid()
  )
  or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
);

create policy "creators and admins can read wallet"
on public.wallet
for select
using (
  creator_id = auth.uid()
  or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
);

create policy "creators and admins can read wallet transactions"
on public.wallet_tx
for select
using (
  creator_id = auth.uid()
  or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
);

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('previews', 'previews', true)
on conflict (id) do update set public = excluded.public;

create policy "previews are publicly readable"
on storage.objects
for select
using (bucket_id = 'previews');

create policy "creators can upload previews"
on storage.objects
for insert
with check (
  bucket_id = 'previews'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "creators can update previews"
on storage.objects
for update
using (
  bucket_id = 'previews'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'previews'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "creators can delete previews"
on storage.objects
for delete
using (
  bucket_id = 'previews'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "creators can upload private assets"
on storage.objects
for insert
with check (
  bucket_id = 'assets'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "creators can update private assets"
on storage.objects
for update
using (
  bucket_id = 'assets'
  and exists (
    select 1
    from public.asset_files af
    join public.assets a on a.id = af.asset_id
    where af.storage_path = name
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
)
with check (
  bucket_id = 'assets'
  and exists (
    select 1
    from public.asset_files af
    join public.assets a on a.id = af.asset_id
    where af.storage_path = name
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

create policy "creators can delete private assets"
on storage.objects
for delete
using (
  bucket_id = 'assets'
  and exists (
    select 1
    from public.asset_files af
    join public.assets a on a.id = af.asset_id
    where af.storage_path = name
      and (
        a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

create policy "paid buyers can read private assets"
on storage.objects
for select
using (
  bucket_id = 'assets'
  and (
    exists (
      select 1
      from public.asset_files af
      join public.assets a on a.id = af.asset_id
      where af.storage_path = name
        and (
          a.creator_id = auth.uid()
          or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
        )
    )
    or exists (
      select 1
      from public.asset_files af
      join public.orders o on o.asset_id = af.asset_id
      where af.storage_path = name
        and o.status = 'paid'
        and (
          o.buyer_id = auth.uid()
          or o.email = (auth.jwt() ->> 'email')
          or (public.request_order_token() <> '' and o.email_token::text = public.request_order_token())
        )
    )
  )
);
