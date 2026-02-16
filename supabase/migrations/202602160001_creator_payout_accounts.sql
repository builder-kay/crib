create table if not exists public.creator_payout_accounts (
  creator_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null default 'paystack',
  status text not null default 'active',
  country text not null default 'ghana',
  business_name text not null,
  subaccount_code text not null unique,
  settlement_bank_code text not null,
  settlement_bank_name text,
  account_number_last4 text not null,
  account_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_payout_accounts_provider_check check (provider = 'paystack'),
  constraint creator_payout_accounts_status_check check (status in ('active', 'inactive')),
  constraint creator_payout_accounts_account_last4_check check (char_length(account_number_last4) = 4)
);

create index if not exists creator_payout_accounts_subaccount_code_idx
on public.creator_payout_accounts (subaccount_code);

drop trigger if exists set_creator_payout_accounts_updated_at on public.creator_payout_accounts;
create trigger set_creator_payout_accounts_updated_at
before update on public.creator_payout_accounts
for each row execute function public.set_updated_at();

alter table public.creator_payout_accounts enable row level security;

drop policy if exists "creators and admins can read payout accounts" on public.creator_payout_accounts;
create policy "creators and admins can read payout accounts"
on public.creator_payout_accounts
for select
using (
  creator_id = auth.uid()
  or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
);

drop policy if exists "creators can insert own payout account" on public.creator_payout_accounts;
create policy "creators can insert own payout account"
on public.creator_payout_accounts
for insert
with check (creator_id = auth.uid());

drop policy if exists "creators can update own payout account" on public.creator_payout_accounts;
create policy "creators can update own payout account"
on public.creator_payout_accounts
for update
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

drop policy if exists "admins can manage payout accounts" on public.creator_payout_accounts;
create policy "admins can manage payout accounts"
on public.creator_payout_accounts
for all
using (exists (select 1 from public.admins ad where ad.user_id = auth.uid()))
with check (exists (select 1 from public.admins ad where ad.user_id = auth.uid()));

notify pgrst, 'reload schema';
