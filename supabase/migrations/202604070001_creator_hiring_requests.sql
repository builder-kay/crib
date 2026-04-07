alter table public.profiles
  add column if not exists hire_enabled boolean not null default true,
  add column if not exists hire_terms text not null default $hire_terms$
Scope, timeline, budget, revisions, and deliverables will be confirmed in writing before work begins.

Source files, transfer rights, and final handoff details depend on the final approved agreement.

Projects start only after both sides confirm the brief, budget, and schedule.
$hire_terms$;

update public.profiles
set
  hire_enabled = coalesce(hire_enabled, true),
  hire_terms = case
    when coalesce(btrim(hire_terms), '') = '' then $hire_terms$
Scope, timeline, budget, revisions, and deliverables will be confirmed in writing before work begins.

Source files, transfer rights, and final handoff details depend on the final approved agreement.

Projects start only after both sides confirm the brief, budget, and schedule.
$hire_terms$
    else hire_terms
  end;

create table if not exists public.creator_hire_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  requester_display_name text not null default '',
  requester_email text,
  terms_snapshot text not null default '',
  channel text not null default 'in_app',
  delivery_status text not null default 'pending',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint creator_hire_requests_channel_check check (channel in ('in_app')),
  constraint creator_hire_requests_status_check check (delivery_status in ('pending', 'sent', 'dismissed', 'failed')),
  constraint creator_hire_requests_self_request_check check (creator_id <> requester_id),
  constraint creator_hire_requests_unique unique (creator_id, requester_id)
);

create index if not exists creator_hire_requests_creator_idx
  on public.creator_hire_requests (creator_id, created_at desc);

create index if not exists creator_hire_requests_requester_idx
  on public.creator_hire_requests (requester_id, created_at desc);

create or replace function public.submit_creator_hire_request(p_creator_id uuid)
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

  select
    p.hire_enabled,
    coalesce(nullif(btrim(p.hire_terms), ''), $hire_terms$
Scope, timeline, budget, revisions, and deliverables will be confirmed in writing before work begins.

Source files, transfer rights, and final handoff details depend on the final approved agreement.

Projects start only after both sides confirm the brief, budget, and schedule.
$hire_terms$)
  into v_hire_enabled, v_terms_snapshot
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
    delivery_status = 'pending',
    created_at = now(),
    read_at = null
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.submit_creator_hire_request(uuid) from public;
grant execute on function public.submit_creator_hire_request(uuid) to authenticated;

alter table public.creator_hire_requests enable row level security;

drop policy if exists "users can read related hire requests" on public.creator_hire_requests;
create policy "users can read related hire requests"
on public.creator_hire_requests
for select
using (creator_id = auth.uid() or requester_id = auth.uid());

drop policy if exists "creators can update own hire requests" on public.creator_hire_requests;
create policy "creators can update own hire requests"
on public.creator_hire_requests
for update
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

notify pgrst, 'reload schema';
