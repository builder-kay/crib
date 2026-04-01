create table if not exists public.editorial_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.editorial_admins enable row level security;

drop policy if exists "users can view own editorial admin record" on public.editorial_admins;
create policy "users can view own editorial admin record"
on public.editorial_admins
for select
using (user_id = auth.uid());

drop policy if exists "admins can manage editorial posts" on public.editorial_posts;
drop policy if exists "editorial admins can manage editorial posts" on public.editorial_posts;
create policy "editorial admins can manage editorial posts"
on public.editorial_posts
for all
using (exists (select 1 from public.editorial_admins ea where ea.user_id = auth.uid()))
with check (exists (select 1 from public.editorial_admins ea where ea.user_id = auth.uid()));

notify pgrst, 'reload schema';
