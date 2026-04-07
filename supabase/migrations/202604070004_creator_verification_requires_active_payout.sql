create or replace function public.creator_verification_missing_fields(
  p_display_name text,
  p_bio text,
  p_avatar_url text,
  p_creator_category text,
  p_niche text,
  p_socials jsonb,
  p_has_active_payout_account boolean
)
returns text[]
language plpgsql
stable
as $$
declare
  v_missing text[] := '{}'::text[];
begin
  if coalesce(length(btrim(coalesce(p_avatar_url, ''))), 0) < 1 then
    v_missing := array_append(v_missing, 'avatar');
  end if;

  if coalesce(length(btrim(coalesce(p_display_name, ''))), 0) < 2 then
    v_missing := array_append(v_missing, 'display_name');
  end if;

  if coalesce(length(btrim(coalesce(p_creator_category, ''))), 0) < 2 then
    v_missing := array_append(v_missing, 'creator_category');
  end if;

  if coalesce(length(btrim(coalesce(p_niche, ''))), 0) < 2 then
    v_missing := array_append(v_missing, 'niche');
  end if;

  if coalesce(length(btrim(coalesce(p_bio, ''))), 0) < 20 then
    v_missing := array_append(v_missing, 'bio');
  end if;

  if not (
    coalesce(length(btrim(coalesce(p_socials ->> 'website', ''))), 0) >= 1
    or coalesce(length(btrim(coalesce(p_socials ->> 'instagram', ''))), 0) >= 1
    or coalesce(length(btrim(coalesce(p_socials ->> 'x', ''))), 0) >= 1
  ) then
    v_missing := array_append(v_missing, 'social_link');
  end if;

  if coalesce(p_has_active_payout_account, false) is not true then
    v_missing := array_append(v_missing, 'payout_details');
  end if;

  return v_missing;
end;
$$;

create or replace function public.sync_creator_verification_request(p_creator_id uuid)
returns public.creator_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_payout_account public.creator_payout_accounts%rowtype;
  v_existing public.creator_verification_requests%rowtype;
  v_request public.creator_verification_requests%rowtype;
  v_missing_fields text[];
  v_is_profile_complete boolean;
  v_has_active_payout_account boolean := false;
  v_status public.creator_verification_status;
  v_submitted_at timestamptz;
  v_reviewed_at timestamptz;
  v_reviewed_by uuid;
  v_review_note text;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_creator_id;

  if not found then
    raise exception 'Creator profile not found.';
  end if;

  select *
  into v_payout_account
  from public.creator_payout_accounts
  where creator_id = p_creator_id;

  v_has_active_payout_account := found and v_payout_account.status = 'active';

  select *
  into v_existing
  from public.creator_verification_requests
  where creator_id = p_creator_id;

  v_missing_fields := public.creator_verification_missing_fields(
    v_profile.display_name,
    v_profile.bio,
    v_profile.avatar_url,
    v_profile.creator_category,
    v_profile.niche,
    v_profile.socials,
    v_has_active_payout_account
  );

  v_is_profile_complete := coalesce(array_length(v_missing_fields, 1), 0) = 0;

  if v_profile.is_verified is true and v_is_profile_complete then
    v_status := 'approved';
    v_submitted_at := coalesce(v_existing.submitted_at, now());
    v_reviewed_at := coalesce(v_existing.reviewed_at, now());
    v_reviewed_by := v_existing.reviewed_by;
    v_review_note := v_existing.review_note;
  elsif v_is_profile_complete then
    v_status := 'pending';
    v_submitted_at := case
      when v_existing.status = 'pending' then coalesce(v_existing.submitted_at, now())
      else now()
    end;
    v_reviewed_at := null;
    v_reviewed_by := null;
    v_review_note := null;
  else
    v_status := 'incomplete';
    v_submitted_at := null;
    v_reviewed_at := null;
    v_reviewed_by := null;
    v_review_note := null;
  end if;

  insert into public.creator_verification_requests (
    creator_id,
    status,
    is_profile_complete,
    missing_fields,
    profile_snapshot,
    submitted_at,
    reviewed_at,
    reviewed_by,
    review_note
  )
  values (
    p_creator_id,
    v_status,
    v_is_profile_complete,
    v_missing_fields,
    jsonb_build_object(
      'display_name', coalesce(v_profile.display_name, ''),
      'bio', coalesce(v_profile.bio, ''),
      'avatar_url', coalesce(v_profile.avatar_url, ''),
      'creator_category', coalesce(v_profile.creator_category, ''),
      'niche', coalesce(v_profile.niche, ''),
      'socials', coalesce(v_profile.socials, '{}'::jsonb),
      'has_active_payout_account', v_has_active_payout_account,
      'payout_account', case
        when v_payout_account.creator_id is null then null
        else jsonb_build_object(
          'provider', v_payout_account.provider,
          'status', v_payout_account.status,
          'country', v_payout_account.country,
          'payout_type', v_payout_account.payout_type,
          'settlement_bank_code', v_payout_account.settlement_bank_code,
          'settlement_bank_name', coalesce(v_payout_account.settlement_bank_name, ''),
          'account_name', coalesce(v_payout_account.account_name, ''),
          'business_name', coalesce(v_payout_account.business_name, '')
        )
      end
    ),
    v_submitted_at,
    v_reviewed_at,
    v_reviewed_by,
    v_review_note
  )
  on conflict (creator_id) do update
  set
    status = excluded.status,
    is_profile_complete = excluded.is_profile_complete,
    missing_fields = excluded.missing_fields,
    profile_snapshot = excluded.profile_snapshot,
    submitted_at = excluded.submitted_at,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by,
    review_note = excluded.review_note
  returning * into v_request;

  update public.profiles
  set is_verified = (v_status = 'approved')
  where id = p_creator_id
    and is_verified is distinct from (v_status = 'approved');

  return v_request;
end;
$$;

create or replace function public.handle_creator_verification_request_sync_from_payout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_creator_verification_request(coalesce(new.creator_id, old.creator_id));

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_creator_verification_request_on_payout_account on public.creator_payout_accounts;
create trigger sync_creator_verification_request_on_payout_account
after insert or update or delete on public.creator_payout_accounts
for each row execute function public.handle_creator_verification_request_sync_from_payout();

create or replace function public.review_creator_verification_request(
  p_creator_id uuid,
  p_decision text,
  p_review_note text default ''
)
returns table (
  creator_id uuid,
  status public.creator_verification_status,
  is_verified boolean,
  review_note text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_request public.creator_verification_requests%rowtype;
  v_status public.creator_verification_status;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
begin
  if v_admin_id is null then
    raise exception 'Sign in as an admin to review creator verification.';
  end if;

  if not exists (
    select 1
    from public.admins ad
    where ad.user_id = v_admin_id
  ) then
    raise exception 'Only admins can review creator verification.';
  end if;

  if p_creator_id is null then
    raise exception 'Choose a creator to review.';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Verification review must be approve or reject.';
  end if;

  perform public.sync_creator_verification_request(p_creator_id);

  select *
  into v_request
  from public.creator_verification_requests
  where creator_id = p_creator_id
  for update;

  if not found then
    raise exception 'Verification request not found.';
  end if;

  if p_decision = 'approve' and v_request.is_profile_complete is distinct from true then
    raise exception 'This creator has not completed the required profile and payout details yet.';
  end if;

  v_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;

  update public.profiles
  set is_verified = (v_status = 'approved')
  where id = p_creator_id;

  update public.creator_verification_requests
  set
    status = v_status,
    submitted_at = coalesce(submitted_at, now()),
    reviewed_at = now(),
    reviewed_by = v_admin_id,
    review_note = case
      when v_status = 'rejected' then coalesce(v_note, 'Verification was not approved. Update your profile or payout details and save again to resubmit.')
      else v_note
    end
  where creator_id = p_creator_id;

  return query
  select
    r.creator_id,
    r.status,
    p.is_verified,
    r.review_note,
    r.reviewed_at
  from public.creator_verification_requests r
  join public.profiles p on p.id = r.creator_id
  where r.creator_id = p_creator_id;
end;
$$;

do $$
declare
  profile_row record;
begin
  for profile_row in
    select id
    from public.profiles
  loop
    perform public.sync_creator_verification_request(profile_row.id);
  end loop;
end
$$;

notify pgrst, 'reload schema';
