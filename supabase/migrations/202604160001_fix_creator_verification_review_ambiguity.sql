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
set search_path = pu5blic
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

  select cvr.*
  into v_request
  from public.creator_verification_requests cvr
  where cvr.creator_id = p_creator_id
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

  update public.creator_verification_requests as cvr
  set
    status = v_status,
    submitted_at = coalesce(cvr.submitted_at, now()),
    reviewed_at = now(),
    reviewed_by = v_admin_id,
    review_note = case
      when v_status = 'rejected' then coalesce(v_note, 'Verification was not approved. Update your profile or payout details and save again to resubmit.')
      else v_note
    end
  where cvr.creator_id = p_creator_id;

  return query
  select
    cvr.creator_id,
    cvr.status,
    p.is_verified,
    cvr.review_note,
    cvr.reviewed_at
  from public.creator_verification_requests cvr
  join public.profiles p on p.id = cvr.creator_id
  where cvr.creator_id = p_creator_id;
end;
$$;

revoke all on function public.review_creator_verification_request(uuid, text, text) from public;
grant execute on function public.review_creator_verification_request(uuid, text, text) to authenticated;
