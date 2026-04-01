create table if not exists public.platform_settings (
  singleton boolean primary key default true check (singleton),
  instagram_handle text not null default '',
  x_handle text not null default '',
  tiktok_handle text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (singleton)
values (true)
on conflict (singleton) do nothing;

drop trigger if exists set_platform_settings_updated_at on public.platform_settings;
create trigger set_platform_settings_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

create policy "platform settings are publicly readable"
on public.platform_settings
for select
using (true);

create policy "admins can manage platform settings"
on public.platform_settings
for all
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

notify pgrst, 'reload schema';
