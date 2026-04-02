do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_scam_resolution_status'
  ) then
    create type public.order_scam_resolution_status as enum ('pending_review', 'genuine_released', 'buyer_refunded');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'seller_account_status'
  ) then
    create type public.seller_account_status as enum ('active', 'warned', 'suspended');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'order_seller_action'
  ) then
    create type public.order_seller_action as enum ('none', 'warned', 'suspended');
  end if;
end
$$;

alter table public.profiles
  add column if not exists seller_account_status public.seller_account_status not null default 'active',
  add column if not exists seller_account_note text,
  add column if not exists seller_account_updated_at timestamptz,
  add column if not exists seller_account_updated_by uuid references public.profiles (id) on delete set null;

create index if not exists profiles_seller_account_status_idx on public.profiles (seller_account_status);

alter table public.orders
  add column if not exists scam_resolution_status public.order_scam_resolution_status,
  add column if not exists scam_resolution_note text,
  add column if not exists seller_issue_note text,
  add column if not exists scam_resolved_at timestamptz,
  add column if not exists scam_resolved_by uuid references public.profiles (id) on delete set null,
  add column if not exists seller_moderation_action public.order_seller_action,
  add column if not exists refund_reference text,
  add column if not exists refund_provider_status text;

create index if not exists orders_scam_resolution_status_idx
  on public.orders (scam_resolution_status)
  where escrow_status = 'scam_reported';

update public.orders
set scam_resolution_status = 'pending_review'
where escrow_status = 'scam_reported'
  and scam_resolution_status is null;

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
    scam_report_reason = normalized_reason,
    scam_resolution_status = 'pending_review',
    scam_resolution_note = null,
    seller_issue_note = null,
    scam_resolved_at = null,
    scam_resolved_by = null,
    seller_moderation_action = null,
    refund_reference = null,
    refund_provider_status = null
  where id = p_order_id;

  return query
  select
    o.id,
    o.escrow_status,
    o.buyer_reported_at,
    coalesce(o.scam_report_reason, '')
  from public.orders o
  where o.id = p_order_id;
end;
$$;

revoke all on function public.report_order_file_scam(uuid, text) from public;
grant execute on function public.report_order_file_scam(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
