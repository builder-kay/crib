alter table public.profiles
  add column if not exists hire_pricing_guide text;

update public.profiles
set hire_pricing_guide = nullif(btrim(hire_pricing_guide), '')
where hire_pricing_guide is not null;

alter table public.creator_hire_requests
  add column if not exists client_message text not null default '',
  add column if not exists pricing_guide_snapshot text;

update public.creator_hire_requests
set
  client_message = coalesce(nullif(btrim(client_message), ''), ''),
  pricing_guide_snapshot = nullif(btrim(pricing_guide_snapshot), '');

drop function if exists public.submit_creator_hire_request(uuid);

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
    nullif(btrim(p.hire_pricing_guide), '')
  into v_hire_enabled, v_terms_snapshot, v_pricing_guide_snapshot
  from public.profiles p
  where p.id = p_creator_id;

  if not found then
    raise exception 'This creator profile could not be found.';
  end if;

  if v_hire_enabled is distinct from true then
    raise exception 'This creator is not accepting hire requests right now.';
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
