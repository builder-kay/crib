create table if not exists public.editorial_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  category text not null check (category in ('Industry', 'Creator Economy', 'Design', 'Music', 'Film')),
  published_at timestamptz not null default now(),
  read_time_minutes integer not null check (read_time_minutes > 0),
  cover_image text not null,
  spotlight boolean not null default false,
  tags text[] not null default '{}'::text[],
  author_name text not null,
  author_role text not null,
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editorial_posts_published_idx on public.editorial_posts (published_at desc);
create index if not exists editorial_posts_category_idx on public.editorial_posts (category);

drop trigger if exists set_editorial_posts_updated_at on public.editorial_posts;
create trigger set_editorial_posts_updated_at
before update on public.editorial_posts
for each row execute function public.set_updated_at();

alter table public.editorial_posts enable row level security;

drop policy if exists "editorial posts are public" on public.editorial_posts;
create policy "editorial posts are public"
on public.editorial_posts
for select
using (true);

drop policy if exists "admins can manage editorial posts" on public.editorial_posts;
create policy "admins can manage editorial posts"
on public.editorial_posts
for all
using (exists (select 1 from public.admins ad where ad.user_id = auth.uid()))
with check (exists (select 1 from public.admins ad where ad.user_id = auth.uid()));

notify pgrst, 'reload schema';
