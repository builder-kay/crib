create or replace function public.resolve_reported_order_as_genuine(
  p_order_id uuid
)
returns table (
  order_id uuid,
  escrow_status public.order_escrow_status,
  credited boolean,
  escrow_released_at timestamptz,
  escrow_release_reason text,
  scam_resolution_status public.order_scam_resolution_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row record;
  requester_email text;
  credit_result boolean := false;
begin
  requester_email := auth.jwt() ->> 'email';

  select
    o.id,
    o.buyer_id,
    o.email,
    o.status,
    o.escrow_status,
    o.escrow_released_at,
    o.escrow_release_reason,
    o.scam_resolution_status,
    o.seller_net_amount_kobo,
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
    or (
      requester_email is not null
      and requester_email <> ''
      and order_row.email = requester_email
    )
  ) then
    raise exception 'You are not allowed to resolve this order';
  end if;

  if order_row.status <> 'paid' then
    raise exception 'Only paid orders can be resolved this way';
  end if;

  if order_row.escrow_status = 'released' then
    return query
    select
      order_row.id,
      order_row.escrow_status,
      false,
      order_row.escrow_released_at,
      order_row.escrow_release_reason,
      coalesce(order_row.scam_resolution_status, 'genuine_released'::public.order_scam_resolution_status);
    return;
  end if;

  if order_row.escrow_status <> 'scam_reported' then
    raise exception 'Only reported orders can be marked as resolved';
  end if;

  credit_result := public.credit_wallet(order_row.creator_id, order_row.id, order_row.seller_net_amount_kobo);

  update public.orders as o
  set
    buyer_confirmed_at = coalesce(o.buyer_confirmed_at, now()),
    escrow_status = 'released',
    escrow_released_at = coalesce(o.escrow_released_at, now()),
    escrow_release_reason = 'buyer_resolved_report',
    scam_resolution_status = 'genuine_released',
    scam_resolution_note = 'Buyer marked the reported delivery as resolved.',
    scam_resolved_at = now(),
    scam_resolved_by = coalesce(o.scam_resolved_by, auth.uid()),
    seller_issue_note = null
  where o.id = order_row.id;

  return query
  select
    o.id,
    o.escrow_status,
    credit_result,
    o.escrow_released_at,
    o.escrow_release_reason,
    o.scam_resolution_status
  from public.orders o
  where o.id = order_row.id;
end;
$$;

revoke all on function public.resolve_reported_order_as_genuine(uuid) from public;
grant execute on function public.resolve_reported_order_as_genuine(uuid) to authenticated;

notify pgrst, 'reload schema';
