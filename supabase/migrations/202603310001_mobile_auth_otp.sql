create table if not exists public.auth_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  intent text not null check (intent in ('register', 'reset')),
  normalized_phone text not null,
  normalized_email text,
  target_user_id uuid references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_otp_challenges_phone_intent_unique unique (intent, normalized_phone)
);

create index if not exists auth_otp_challenges_target_user_idx
  on public.auth_otp_challenges (target_user_id);

create index if not exists auth_otp_challenges_email_idx
  on public.auth_otp_challenges (normalized_email);

drop trigger if exists set_auth_otp_challenges_updated_at on public.auth_otp_challenges;
create trigger set_auth_otp_challenges_updated_at
before update on public.auth_otp_challenges
for each row execute function public.set_updated_at();

create or replace function public.lookup_auth_identity(
  p_phone text default null,
  p_email text default null
)
returns table (
  user_id uuid,
  phone text,
  email text,
  display_name text
)
language sql
security definer
set search_path = auth, public
as $$
  select
    u.id as user_id,
    u.phone,
    coalesce(
      nullif(lower(u.email), ''),
      nullif(lower(u.raw_user_meta_data ->> 'contact_email'), '')
    ) as email,
    coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), 'Creator') as display_name
  from auth.users u
  where u.deleted_at is null
    and (
      (
        nullif(trim(coalesce(p_phone, '')), '') is not null
        and u.phone = trim(p_phone)
      )
      or (
        nullif(lower(trim(coalesce(p_email, ''))), '') is not null
        and (
          lower(coalesce(u.email, '')) = lower(trim(p_email))
          or lower(coalesce(u.raw_user_meta_data ->> 'contact_email', '')) = lower(trim(p_email))
        )
      )
    )
  order by u.updated_at desc nulls last, u.created_at desc
  limit 1;
$$;

revoke all on function public.lookup_auth_identity(text, text) from public;
grant execute on function public.lookup_auth_identity(text, text) to service_role;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_name text;
begin
  fallback_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(new.phone, ''),
    'Creator'
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    fallback_name,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.wallet (creator_id, balance_kobo)
  values (new.id, 0)
  on conflict (creator_id) do nothing;

  return new;
end;
$$;

alter table public.auth_otp_challenges enable row level security;

notify pgrst, 'reload schema';
