do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_escrow_status'
  ) then
    create type public.order_escrow_status as enum ('awaiting_review', 'released', 'scam_reported');
  end if;
end
$$;

alter table public.orders
  add column if not exists commission_kobo integer not null default 0 check (commission_kobo >= 0),
  add column if not exists seller_net_amount_kobo integer not null default 0 check (seller_net_amount_kobo >= 0),
  add column if not exists escrow_status public.order_escrow_status,
  add column if not exists escrow_due_at timestamptz,
  add column if not exists buyer_opened_at timestamptz,
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists buyer_reported_at timestamptz,
  add column if not exists escrow_released_at timestamptz,
  add column if not exists escrow_release_reason text,
  add column if not exists scam_report_reason text;

create index if not exists orders_escrow_status_idx on public.orders (escrow_status);
create index if not exists orders_escrow_due_idx on public.orders (escrow_due_at) where escrow_status = 'awaiting_review';

update public.orders
set
  commission_kobo = floor((amount_kobo::numeric * 1000) / 10000)::integer,
  seller_net_amount_kobo = greatest(amount_kobo - floor((amount_kobo::numeric * 1000) / 10000)::integer, 0)
where commission_kobo = 0
   or seller_net_amount_kobo = 0;

update public.orders
set
  escrow_status = 'released',
  escrow_due_at = coalesce(escrow_due_at, paid_at, created_at),
  buyer_confirmed_at = coalesce(buyer_confirmed_at, paid_at, created_at),
  escrow_released_at = coalesce(escrow_released_at, paid_at, created_at),
  escrow_release_reason = coalesce(escrow_release_reason, 'legacy_paid_order')
where status = 'paid'
  and escrow_status is null;

create or replace function public.release_due_order_escrows()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row record;
  released_count integer := 0;
begin
  for order_row in
    select o.id, o.seller_net_amount_kobo, a.creator_id
    from public.orders o
    join public.assets a on a.id = o.asset_id
    where o.status = 'paid'
      and o.escrow_status = 'awaiting_review'
      and o.escrow_due_at is not null
      and o.escrow_due_at <= now()
    order by o.escrow_due_at asc
  loop
    perform public.credit_wallet(order_row.creator_id, order_row.id, order_row.seller_net_amount_kobo);

    update public.orders
    set
      escrow_status = 'released',
      escrow_released_at = coalesce(escrow_released_at, now()),
      escrow_release_reason = coalesce(escrow_release_reason, 'auto_timeout')
    where id = order_row.id
      and escrow_status = 'awaiting_review';

    if found then
      released_count := released_count + 1;
    end if;
  end loop;

  return released_count;
end;
$$;

revoke all on function public.release_due_order_escrows() from public;
grant execute on function public.release_due_order_escrows() to anon, authenticated, service_role;

create or replace function public.confirm_order_escrow(
  p_order_id uuid
)
returns table (
  order_id uuid,
  escrow_status public.order_escrow_status,
  credited boolean,
  seller_net_amount_kobo integer,
  commission_kobo integer,
  escrow_due_at timestamptz,
  escrow_released_at timestamptz,
  escrow_release_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row record;
  requester_email text;
  requester_token text;
  credit_result boolean := false;
begin
  requester_email := auth.jwt() ->> 'email';
  requester_token := public.request_order_token();

  select
    o.id,
    o.buyer_id,
    o.email,
    o.email_token,
    o.status,
    o.escrow_status,
    o.escrow_due_at,
    o.escrow_released_at,
    o.escrow_release_reason,
    o.seller_net_amount_kobo,
    o.commission_kobo,
    a.creator_id
  into order_row
  from public.orders o
  join public.assets a on a.id = o.asset_id
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if not (
    order_row.buyer_id = auth.uid()
    or (requester_email is not null and requester_email <> '' and order_row.email = requester_email)
    or (requester_token <> '' and order_row.email_token::text = requester_token)
  ) then
    raise exception 'You are not allowed to confirm this order';
  end if;

  if order_row.status <> 'paid' then
    raise exception 'Payment must be confirmed before escrow can be released';
  end if;

  if order_row.escrow_status = 'scam_reported' then
    raise exception 'This order has already been reported for review';
  end if;

  if order_row.escrow_status = 'released' then
    return query
    select
      order_row.id,
      order_row.escrow_status,
      false,
      order_row.seller_net_amount_kobo,
      order_row.commission_kobo,
      order_row.escrow_due_at,
      order_row.escrow_released_at,
      order_row.escrow_release_reason;
    return;
  end if;

  credit_result := public.credit_wallet(order_row.creator_id, order_row.id, order_row.seller_net_amount_kobo);

  update public.orders
  set
    buyer_confirmed_at = coalesce(buyer_confirmed_at, now()),
    escrow_status = 'released',
    escrow_released_at = coalesce(escrow_released_at, now()),
    escrow_release_reason = 'buyer_confirmed'
  where id = order_row.id;

  return query
  select
    o.id,
    o.escrow_status,
    credit_result,
    o.seller_net_amount_kobo,
    o.commission_kobo,
    o.escrow_due_at,
    o.escrow_released_at,
    o.escrow_release_reason
  from public.orders o
  where o.id = order_row.id;
end;
$$;

revoke all on function public.confirm_order_escrow(uuid) from public;
grant execute on function public.confirm_order_escrow(uuid) to anon, authenticated;

create or replace function public.report_order_file_scam(
  p_order_id uuid,
  p_reason text default ''
)
returns table (
  order_id uuid,
  escrow_status public.order_escrow_status,
  reported_at timestamptz,
  scam_report_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row record;
  requester_email text;
  requester_token text;
  normalized_reason text;
begin
  requester_email := auth.jwt() ->> 'email';
  requester_token := public.request_order_token();
  normalized_reason := left(trim(coalesce(p_reason, '')), 1200);

  select
    o.id,
    o.buyer_id,
    o.email,
    o.email_token,
    o.status,
    o.escrow_status,
    o.buyer_reported_at,
    o.scam_report_reason
  into order_row
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if not (
    order_row.buyer_id = auth.uid()
    or (requester_email is not null and requester_email <> '' and order_row.email = requester_email)
    or (requester_token <> '' and order_row.email_token::text = requester_token)
  ) then
    raise exception 'You are not allowed to report this order';
  end if;

  if order_row.status <> 'paid' then
    raise exception 'Only paid orders can be reported';
  end if;

  if order_row.escrow_status = 'released' then
    raise exception 'Escrow has already been released for this order';
  end if;

  if order_row.escrow_status = 'scam_reported' then
    return query
    select
      order_row.id,
      order_row.escrow_status,
      order_row.buyer_reported_at,
      coalesce(order_row.scam_report_reason, '');
    return;
  end if;

  update public.orders
  set
    escrow_status = 'scam_reported',
    buyer_reported_at = coalesce(buyer_reported_at, now()),
    scam_report_reason = normalized_reason
  where id = order_row.id;

  return query
  select
    o.id,
    o.escrow_status,
    o.buyer_reported_at,
    coalesce(o.scam_report_reason, '')
  from public.orders o
  where o.id = order_row.id;
end;
$$;

revoke all on function public.report_order_file_scam(uuid, text) from public;
grant execute on function public.report_order_file_scam(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
