alter table public.asset_files
  add column if not exists immutable_storage_path text,
  add column if not exists file_sha256 text,
  add column if not exists immutable_locked_at timestamptz;

alter table public.asset_files
  drop constraint if exists asset_files_file_sha256_check;

alter table public.asset_files
  add constraint asset_files_file_sha256_check
  check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$');

create unique index if not exists asset_files_immutable_storage_path_idx
  on public.asset_files (immutable_storage_path)
  where immutable_storage_path is not null;

alter table public.orders
  add column if not exists delivery_storage_path text,
  add column if not exists delivery_original_name text,
  add column if not exists delivery_file_type text,
  add column if not exists delivery_file_size bigint,
  add column if not exists delivery_file_sha256 text,
  add column if not exists delivery_locked_at timestamptz;

alter table public.orders
  drop constraint if exists orders_delivery_file_size_check;

alter table public.orders
  add constraint orders_delivery_file_size_check
  check (delivery_file_size is null or delivery_file_size >= 0);

alter table public.orders
  drop constraint if exists orders_delivery_file_sha256_check;

alter table public.orders
  add constraint orders_delivery_file_sha256_check
  check (delivery_file_sha256 is null or delivery_file_sha256 ~ '^[0-9a-f]{64}$');

drop policy if exists "creators and paid buyers can read asset files" on public.asset_files;
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
      )
  )
);

drop policy if exists "creators can insert files for own assets" on public.asset_files;
create policy "creators can insert files for own assets"
on public.asset_files
for insert
with check (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        exists (select 1 from public.admins ad where ad.user_id = auth.uid())
        or (
          a.creator_id = auth.uid()
          and not exists (
            select 1
            from public.orders o
            where o.asset_id = a.id
              and o.status in ('paid', 'refunded')
          )
        )
      )
  )
);

drop policy if exists "creators can update own files" on public.asset_files;
create policy "creators can update own files"
on public.asset_files
for update
using (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        exists (select 1 from public.admins ad where ad.user_id = auth.uid())
        or (
          a.creator_id = auth.uid()
          and not exists (
            select 1
            from public.orders o
            where o.asset_id = a.id
              and o.status in ('paid', 'refunded')
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        exists (select 1 from public.admins ad where ad.user_id = auth.uid())
        or (
          a.creator_id = auth.uid()
          and not exists (
            select 1
            from public.orders o
            where o.asset_id = a.id
              and o.status in ('paid', 'refunded')
          )
        )
      )
  )
);

drop policy if exists "creators can delete own files" on public.asset_files;
create policy "creators can delete own files"
on public.asset_files
for delete
using (
  exists (
    select 1
    from public.assets a
    where a.id = asset_id
      and (
        exists (select 1 from public.admins ad where ad.user_id = auth.uid())
        or (
          a.creator_id = auth.uid()
          and not exists (
            select 1
            from public.orders o
            where o.asset_id = a.id
              and o.status in ('paid', 'refunded')
          )
        )
      )
  )
);

drop policy if exists "buyers creators and admins can read orders" on public.orders;
create policy "buyers creators and admins can read orders"
on public.orders
for select
using (
  buyer_id = auth.uid()
  or email = (auth.jwt() ->> 'email')
  or exists (
    select 1
    from public.assets a
    where a.id = orders.asset_id
      and a.creator_id = auth.uid()
  )
  or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
);

drop policy if exists "buyers creators and admins can read payments" on public.payments;
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

drop policy if exists "creators can update private assets" on storage.objects;
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
        exists (select 1 from public.admins ad where ad.user_id = auth.uid())
        or (
          a.creator_id = auth.uid()
          and not exists (
            select 1
            from public.orders o
            where o.asset_id = af.asset_id
              and o.status in ('paid', 'refunded')
          )
        )
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
        exists (select 1 from public.admins ad where ad.user_id = auth.uid())
        or (
          a.creator_id = auth.uid()
          and not exists (
            select 1
            from public.orders o
            where o.asset_id = af.asset_id
              and o.status in ('paid', 'refunded')
          )
        )
      )
  )
);

drop policy if exists "creators can delete private assets" on storage.objects;
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
        exists (select 1 from public.admins ad where ad.user_id = auth.uid())
        or (
          a.creator_id = auth.uid()
          and not exists (
            select 1
            from public.orders o
            where o.asset_id = af.asset_id
              and o.status in ('paid', 'refunded')
          )
        )
      )
  )
);

drop policy if exists "paid buyers can read private assets" on storage.objects;
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
        )
    )
  )
);

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
  credit_result boolean := false;
begin
  select
    o.id,
    o.buyer_id,
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

  if order_row.buyer_id <> auth.uid() then
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
grant execute on function public.confirm_order_escrow(uuid) to authenticated;

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
  normalized_reason text;
begin
  normalized_reason := left(trim(coalesce(p_reason, '')), 1200);

  select
    o.id,
    o.buyer_id,
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

  if order_row.buyer_id <> auth.uid() then
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
grant execute on function public.report_order_file_scam(uuid, text) to authenticated;

notify pgrst, 'reload schema';
