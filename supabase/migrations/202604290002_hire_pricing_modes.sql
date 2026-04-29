alter table public.profiles
  add column if not exists hire_pricing_mode text not null default 'dm_to_know',
  add column if not exists hire_hourly_rate_kobo integer,
  add column if not exists hire_pricing_currency text not null default 'GHS';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_hire_pricing_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_hire_pricing_mode_check
      check (hire_pricing_mode in ('hourly', 'custom_list', 'dm_to_know'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_hire_hourly_rate_kobo_check'
  ) then
    alter table public.profiles
      add constraint profiles_hire_hourly_rate_kobo_check
      check (hire_hourly_rate_kobo is null or hire_hourly_rate_kobo >= 0);
  end if;
end
$$;

update public.profiles
set hire_pricing_mode = 'custom_list'
where coalesce(nullif(btrim(hire_pricing_guide), ''), '') <> ''
  and hire_pricing_mode = 'dm_to_know';

update public.profiles
set
  hire_pricing_currency = upper(coalesce(nullif(btrim(hire_pricing_currency), ''), 'GHS')),
  hire_hourly_rate_kobo = case
    when hire_hourly_rate_kobo is not null and hire_hourly_rate_kobo < 0 then null
    else hire_hourly_rate_kobo
  end;

alter table public.creator_hire_requests
  add column if not exists pricing_mode_snapshot text,
  add column if not exists hourly_rate_snapshot_kobo integer,
  add column if not exists pricing_currency_snapshot text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_hire_requests_pricing_mode_snapshot_check'
  ) then
    alter table public.creator_hire_requests
      add constraint creator_hire_requests_pricing_mode_snapshot_check
      check (pricing_mode_snapshot is null or pricing_mode_snapshot in ('hourly', 'custom_list', 'dm_to_know'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_hire_requests_hourly_rate_snapshot_kobo_check'
  ) then
    alter table public.creator_hire_requests
      add constraint creator_hire_requests_hourly_rate_snapshot_kobo_check
      check (hourly_rate_snapshot_kobo is null or hourly_rate_snapshot_kobo >= 0);
  end if;
end
$$;

drop function if exists public.submit_creator_hire_request(uuid, text);

create or replace function public.submit_creator_hire_request(
  p_creator_id uuid,
  p_client_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
  v_request_id uuid;
  v_requester_display_name text;
  v_requester_email text;
  v_hire_enabled boolean;
  v_terms_snapshot text;
  v_pricing_mode_snapshot text;
  v_hourly_rate_snapshot_kobo integer;
  v_pricing_currency_snapshot text;
  v_pricing_guide_snapshot text;
  v_client_message text := coalesce(nullif(btrim(p_client_message), ''), '');
begin
  if v_requester_id is null then
    raise exception 'Sign in to hire this creator.';
  end if;

  if p_creator_id is null then
    raise exception 'Choose a creator to hire.';
  end if;

  if v_requester_id = p_creator_id then
    raise exception 'You cannot hire yourself.';
  end if;

  if char_length(v_client_message) < 20 then
    raise exception 'Add a message with at least 20 characters.';
  end if;

  if char_length(v_client_message) > 2000 then
    raise exception 'Keep your message under 2000 characters.';
  end if;

  select
    p.hire_enabled,
    coalesce(nullif(btrim(p.hire_terms), ''), $hire_terms$
Scope, timeline, budget, revisions, and deliverables will be confirmed in writing before work begins.

Source files, transfer rights, and final handoff details depend on the final approved agreement.

Projects start only after both sides confirm the brief, budget, and schedule.
$hire_terms$),
    case
      when p.hire_pricing_mode in ('hourly', 'custom_list', 'dm_to_know') then p.hire_pricing_mode
      when nullif(btrim(p.hire_pricing_guide), '') is not null then 'custom_list'
      else 'dm_to_know'
    end,
    case
      when p.hire_hourly_rate_kobo is not null and p.hire_hourly_rate_kobo > 0 then p.hire_hourly_rate_kobo
      else null
    end,
    upper(coalesce(nullif(btrim(p.hire_pricing_currency), ''), 'GHS')),
    case
      when (
        case
          when p.hire_pricing_mode in ('hourly', 'custom_list', 'dm_to_know') then p.hire_pricing_mode
          when nullif(btrim(p.hire_pricing_guide), '') is not null then 'custom_list'
          else 'dm_to_know'
        end
      ) = 'custom_list' then nullif(btrim(p.hire_pricing_guide), '')
      else null
    end
  into
    v_hire_enabled,
    v_terms_snapshot,
    v_pricing_mode_snapshot,
    v_hourly_rate_snapshot_kobo,
    v_pricing_currency_snapshot,
    v_pricing_guide_snapshot
  from public.profiles p
  where p.id = p_creator_id;

  if not found then
    raise exception 'This creator profile could not be found.';
  end if;

  if v_hire_enabled is distinct from true then
    raise exception 'This creator is not accepting hire requests right now.';
  end if;

  if v_pricing_mode_snapshot = 'hourly' and v_hourly_rate_snapshot_kobo is null then
    v_pricing_mode_snapshot := 'dm_to_know';
  end if;

  if v_pricing_mode_snapshot <> 'custom_list' then
    v_pricing_guide_snapshot := null;
  end if;

  if v_pricing_mode_snapshot <> 'hourly' then
    v_hourly_rate_snapshot_kobo := null;
  end if;

  select coalesce(nullif(btrim(display_name), ''), 'Client')
  into v_requester_display_name
  from public.profiles
  where id = v_requester_id;

  v_requester_email := nullif(auth.jwt() ->> 'email', '');

  insert into public.creator_hire_requests (
    creator_id,
    requester_id,
    requester_display_name,
    requester_email,
    terms_snapshot,
    pricing_mode_snapshot,
    hourly_rate_snapshot_kobo,
    pricing_currency_snapshot,
    pricing_guide_snapshot,
    client_message,
    channel,
    delivery_status,
    created_at,
    read_at
  )
  values (
    p_creator_id,
    v_requester_id,
    coalesce(v_requester_display_name, 'Client'),
    v_requester_email,
    v_terms_snapshot,
    v_pricing_mode_snapshot,
    v_hourly_rate_snapshot_kobo,
    v_pricing_currency_snapshot,
    v_pricing_guide_snapshot,
    v_client_message,
    'in_app',
    'pending',
    now(),
    null
  )
  on conflict (creator_id, requester_id) do update
  set
    requester_display_name = excluded.requester_display_name,
    requester_email = excluded.requester_email,
    terms_snapshot = excluded.terms_snapshot,
    pricing_mode_snapshot = excluded.pricing_mode_snapshot,
    hourly_rate_snapshot_kobo = excluded.hourly_rate_snapshot_kobo,
    pricing_currency_snapshot = excluded.pricing_currency_snapshot,
    pricing_guide_snapshot = excluded.pricing_guide_snapshot,
    client_message = excluded.client_message,
    delivery_status = 'pending',
    created_at = now(),
    read_at = null
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.submit_creator_hire_request(uuid, text) from public;
grant execute on function public.submit_creator_hire_request(uuid, text) to authenticated;

notify pgrst, 'reload schema';
