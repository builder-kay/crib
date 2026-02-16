create table if not exists public.asset_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_reviews_unique_reviewer_per_asset unique (asset_id, reviewer_id),
  constraint asset_reviews_review_text_length_check check (char_length(review_text) <= 1200)
);
create index if not exists asset_reviews_asset_id_idx
on public.asset_reviews (asset_id);
create index if not exists asset_reviews_reviewer_id_idx
on public.asset_reviews (reviewer_id);
create index if not exists asset_reviews_created_at_idx
on public.asset_reviews (created_at desc);
drop trigger if exists set_asset_reviews_updated_at on public.asset_reviews;
create trigger set_asset_reviews_updated_at
before update on public.asset_reviews
for each row execute function public.set_updated_at();
alter table public.asset_reviews enable row level security;
drop policy if exists "asset reviews readable for published assets" on public.asset_reviews;
create policy "asset reviews readable for published assets"
on public.asset_reviews
for select
using (
  reviewer_id = auth.uid()
  or exists (
    select 1
    from public.assets a
    where a.id = asset_reviews.asset_id
      and (
        a.status = 'published'
        or a.creator_id = auth.uid()
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);
drop policy if exists "buyers can insert own review once paid" on public.asset_reviews;
create policy "buyers can insert own review once paid"
on public.asset_reviews
for insert
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1
    from public.assets a
    where a.id = asset_reviews.asset_id
      and a.creator_id <> auth.uid()
  )
  and exists (
    select 1
    from public.orders o
    where o.asset_id = asset_reviews.asset_id
      and o.status = 'paid'
      and (
        o.buyer_id = auth.uid()
        or o.email = (auth.jwt() ->> 'email')
      )
  )
);
drop policy if exists "buyers can update own review" on public.asset_reviews;
create policy "buyers can update own review"
on public.asset_reviews
for update
using (reviewer_id = auth.uid())
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1
    from public.assets a
    where a.id = asset_reviews.asset_id
      and a.creator_id <> auth.uid()
  )
  and exists (
    select 1
    from public.orders o
    where o.asset_id = asset_reviews.asset_id
      and o.status = 'paid'
      and (
        o.buyer_id = auth.uid()
        or o.email = (auth.jwt() ->> 'email')
      )
  )
);
drop policy if exists "buyers can delete own review" on public.asset_reviews;
create policy "buyers can delete own review"
on public.asset_reviews
for delete
using (reviewer_id = auth.uid());
drop policy if exists "admins can manage asset reviews" on public.asset_reviews;
create policy "admins can manage asset reviews"
on public.asset_reviews
for all
using (exists (select 1 from public.admins ad where ad.user_id = auth.uid()))
with check (exists (select 1 from public.admins ad where ad.user_id = auth.uid()));
create or replace function public.get_creator_rating_summary(p_creator_id uuid)
returns table (
  average_rating numeric,
  review_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(round(avg(ar.rating)::numeric, 1), 0)::numeric as average_rating,
    count(ar.id)::bigint as review_count
  from public.asset_reviews ar
  join public.assets a on a.id = ar.asset_id
  where a.creator_id = p_creator_id
    and a.status = 'published';
$$;
grant execute on function public.get_creator_rating_summary(uuid) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
