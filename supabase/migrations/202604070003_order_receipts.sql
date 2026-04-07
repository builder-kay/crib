create table public.order_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  receipt_number text not null unique,
  buyer_id uuid references public.profiles (id) on delete set null,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete restrict,
  buyer_email text not null,
  seller_email text,
  buyer_display_name text,
  seller_display_name text not null,
  asset_title text not null,
  asset_category text,
  payment_provider text not null,
  payment_reference text not null,
  amount_kobo integer not null check (amount_kobo >= 0),
  commission_kobo integer not null default 0 check (commission_kobo >= 0),
  seller_net_amount_kobo integer not null default 0 check (seller_net_amount_kobo >= 0),
  currency text not null check (char_length(currency) between 3 and 6),
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_receipts_buyer_idx on public.order_receipts (buyer_id);
create index order_receipts_seller_idx on public.order_receipts (seller_id);
create index order_receipts_paid_at_idx on public.order_receipts (paid_at desc);

create trigger set_order_receipts_updated_at
before update on public.order_receipts
for each row execute function public.set_updated_at();

alter table public.order_receipts enable row level security;

create policy "buyers sellers and admins can read order receipts"
on public.order_receipts
for select
using (
  buyer_id = auth.uid()
  or buyer_email = (auth.jwt() ->> 'email')
  or seller_id = auth.uid()
  or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
);

insert into public.order_receipts (
  order_id,
  payment_id,
  receipt_number,
  buyer_id,
  seller_id,
  asset_id,
  buyer_email,
  seller_email,
  buyer_display_name,
  seller_display_name,
  asset_title,
  asset_category,
  payment_provider,
  payment_reference,
  amount_kobo,
  commission_kobo,
  seller_net_amount_kobo,
  currency,
  paid_at,
  created_at,
  updated_at
)
select
  o.id as order_id,
  p.id as payment_id,
  'CRIB-RCP-' || to_char(coalesce(o.paid_at, o.created_at), 'YYYYMMDD') || '-' || upper(right(replace(o.id::text, '-', ''), 8)) as receipt_number,
  o.buyer_id,
  a.creator_id as seller_id,
  o.asset_id,
  o.email as buyer_email,
  seller_auth.email as seller_email,
  buyer_profile.display_name as buyer_display_name,
  coalesce(
    nullif(seller_profile.display_name, ''),
    nullif(split_part(coalesce(seller_auth.email, ''), '@', 1), ''),
    'Creator'
  ) as seller_display_name,
  a.title as asset_title,
  a.category as asset_category,
  coalesce(p.provider, 'paystack') as payment_provider,
  coalesce(
    nullif(p.reference, ''),
    'order-' || replace(o.id::text, '-', '')
  ) as payment_reference,
  o.amount_kobo,
  coalesce(o.commission_kobo, 0) as commission_kobo,
  coalesce(o.seller_net_amount_kobo, greatest(o.amount_kobo - coalesce(o.commission_kobo, 0), 0)) as seller_net_amount_kobo,
  o.currency,
  coalesce(o.paid_at, o.created_at) as paid_at,
  coalesce(o.paid_at, o.created_at) as created_at,
  coalesce(o.paid_at, o.created_at) as updated_at
from public.orders o
join public.assets a
  on a.id = o.asset_id
left join public.payments p
  on p.order_id = o.id
left join public.profiles buyer_profile
  on buyer_profile.id = o.buyer_id
left join public.profiles seller_profile
  on seller_profile.id = a.creator_id
left join auth.users seller_auth
  on seller_auth.id = a.creator_id
where o.status in ('paid', 'refunded')
on conflict (order_id) do nothing;
