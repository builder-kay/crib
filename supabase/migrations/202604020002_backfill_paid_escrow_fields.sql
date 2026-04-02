update public.orders
set
  commission_kobo = floor((amount_kobo::numeric * 1000) / 10000)::integer,
  seller_net_amount_kobo = greatest(amount_kobo - floor((amount_kobo::numeric * 1000) / 10000)::integer, 0),
  escrow_status = coalesce(escrow_status, 'released'::public.order_escrow_status),
  escrow_due_at = coalesce(escrow_due_at, paid_at, created_at),
  buyer_confirmed_at = coalesce(buyer_confirmed_at, paid_at, created_at),
  escrow_released_at = coalesce(escrow_released_at, paid_at, created_at),
  escrow_release_reason = coalesce(escrow_release_reason, 'legacy_paid_order')
where status = 'paid'
  and (
    escrow_status is null
    or commission_kobo = 0
    or seller_net_amount_kobo = 0
  );

notify pgrst, 'reload schema';
