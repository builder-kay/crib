alter table public.creator_payout_accounts
add column if not exists payout_type text not null default 'bank';

alter table public.creator_payout_accounts
drop constraint if exists creator_payout_accounts_payout_type_check;

alter table public.creator_payout_accounts
add constraint creator_payout_accounts_payout_type_check
check (payout_type in ('bank', 'mobile_money'));

notify pgrst, 'reload schema';
