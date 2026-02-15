alter table public.profiles
add column if not exists creator_category text not null default 'General';

alter table public.profiles
add column if not exists sales_count integer not null default 0 check (sales_count >= 0);

alter table public.profiles
add column if not exists is_verified boolean not null default false;

update public.profiles as p
set sales_count = coalesce(s.sales_count, 0)
from (
  select creator_id, count(*)::integer as sales_count
  from public.wallet_tx
  where type = 'credit'
  group by creator_id
) as s
where p.id = s.creator_id;

create or replace function public.handle_wallet_tx_sales_count()
returns trigger
language plpgsql
as $$
begin
  if new.type = 'credit' then
    update public.profiles
    set sales_count = sales_count + 1
    where id = new.creator_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_wallet_tx_credit_sales_count on public.wallet_tx;

create trigger on_wallet_tx_credit_sales_count
after insert on public.wallet_tx
for each row execute function public.handle_wallet_tx_sales_count();
