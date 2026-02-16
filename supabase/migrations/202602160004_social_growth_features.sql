create extension if not exists pg_trgm;

create table if not exists public.asset_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_reviews_unique_reviewer unique (asset_id, reviewer_id)
);

create table if not exists public.creator_reviews (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_reviews_unique_reviewer unique (creator_id, reviewer_id),
  constraint creator_reviews_self_review_check check (creator_id <> reviewer_id)
);

create table if not exists public.wishlists (
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, asset_id)
);

create table if not exists public.creator_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  constraint creator_follows_self_follow_check check (follower_id <> creator_id)
);

create table if not exists public.creator_release_notifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  follower_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete cascade,
  channel text not null default 'in_app',
  delivery_status text not null default 'pending',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint creator_release_notifications_channel_check check (channel in ('in_app', 'email')),
  constraint creator_release_notifications_status_check check (delivery_status in ('pending', 'sent', 'dismissed', 'failed')),
  constraint creator_release_notifications_unique unique (creator_id, follower_id, asset_id)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  asset_id uuid references public.assets (id) on delete set null,
  creator_id uuid references public.profiles (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint analytics_events_name_check check (event_name in ('asset_view', 'asset_click', 'checkout_start', 'purchase'))
);

create index if not exists asset_reviews_asset_idx on public.asset_reviews (asset_id);
create index if not exists asset_reviews_reviewer_idx on public.asset_reviews (reviewer_id);

create index if not exists creator_reviews_creator_idx on public.creator_reviews (creator_id);
create index if not exists creator_reviews_reviewer_idx on public.creator_reviews (reviewer_id);

create index if not exists wishlists_user_created_idx on public.wishlists (user_id, created_at desc);
create index if not exists wishlists_asset_idx on public.wishlists (asset_id);

create index if not exists creator_follows_creator_idx on public.creator_follows (creator_id, created_at desc);
create index if not exists creator_follows_follower_idx on public.creator_follows (follower_id, created_at desc);

create index if not exists creator_release_notifications_follower_idx
  on public.creator_release_notifications (follower_id, created_at desc);

create index if not exists analytics_events_creator_event_idx
  on public.analytics_events (creator_id, event_name, occurred_at desc);
create index if not exists analytics_events_event_time_idx
  on public.analytics_events (event_name, occurred_at desc);
create index if not exists analytics_events_asset_idx
  on public.analytics_events (asset_id);
create index if not exists analytics_events_order_idx
  on public.analytics_events (order_id);

create unique index if not exists analytics_events_unique_purchase_order_idx
  on public.analytics_events (order_id)
  where event_name = 'purchase' and order_id is not null;

create index if not exists assets_title_trgm_idx
  on public.assets using gin (title gin_trgm_ops);
create index if not exists assets_description_trgm_idx
  on public.assets using gin (description gin_trgm_ops);
create index if not exists assets_category_price_idx
  on public.assets (category, price_kobo);
create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);

create or replace function public.handle_new_release_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
    and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from 'published')) then
    insert into public.creator_release_notifications (creator_id, follower_id, asset_id, channel, delivery_status)
    select new.creator_id, cf.follower_id, new.id, 'in_app', 'pending'
    from public.creator_follows cf
    where cf.creator_id = new.creator_id
    on conflict (creator_id, follower_id, asset_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_asset_release_notifications on public.assets;
create trigger on_asset_release_notifications
after insert or update of status on public.assets
for each row execute function public.handle_new_release_notifications();

create or replace function public.get_asset_rating_summary(p_asset_id uuid)
returns table (
  average_rating numeric,
  review_count integer
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(round(avg(ar.rating)::numeric, 2), 0::numeric) as average_rating,
    count(*)::integer as review_count
  from public.asset_reviews ar
  where ar.asset_id = p_asset_id;
$$;

drop function if exists public.get_creator_rating_summary(uuid);

create function public.get_creator_rating_summary(p_creator_id uuid)
returns table (
  average_rating numeric,
  review_count integer
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(round(avg(cr.rating)::numeric, 2), 0::numeric) as average_rating,
    count(*)::integer as review_count
  from public.creator_reviews cr
  where cr.creator_id = p_creator_id;
$$;

create or replace function public.get_creator_funnel_summary(p_creator_id uuid)
returns table (
  asset_views integer,
  asset_clicks integer,
  checkout_starts integer,
  purchases integer
)
language sql
stable
set search_path = public
as $$
  select
    count(*) filter (where ae.event_name = 'asset_view')::integer as asset_views,
    count(*) filter (where ae.event_name = 'asset_click')::integer as asset_clicks,
    count(*) filter (where ae.event_name = 'checkout_start')::integer as checkout_starts,
    count(*) filter (where ae.event_name = 'purchase')::integer as purchases
  from public.analytics_events ae
  where ae.creator_id = p_creator_id;
$$;

drop trigger if exists set_asset_reviews_updated_at on public.asset_reviews;
create trigger set_asset_reviews_updated_at
before update on public.asset_reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_creator_reviews_updated_at on public.creator_reviews;
create trigger set_creator_reviews_updated_at
before update on public.creator_reviews
for each row execute function public.set_updated_at();

alter table public.asset_reviews enable row level security;
alter table public.creator_reviews enable row level security;
alter table public.wishlists enable row level security;
alter table public.creator_follows enable row level security;
alter table public.creator_release_notifications enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "asset reviews are public" on public.asset_reviews;
create policy "asset reviews are public"
on public.asset_reviews
for select
using (true);

drop policy if exists "buyers can insert asset reviews" on public.asset_reviews;
create policy "buyers can insert asset reviews"
on public.asset_reviews
for insert
with check (
  auth.uid() = reviewer_id
  and exists (
    select 1
    from public.orders o
    where o.asset_id = asset_id
      and o.status = 'paid'
      and (
        o.buyer_id = auth.uid()
        or o.email = (auth.jwt() ->> 'email')
      )
  )
);

drop policy if exists "reviewers can update own asset reviews" on public.asset_reviews;
create policy "reviewers can update own asset reviews"
on public.asset_reviews
for update
using (reviewer_id = auth.uid())
with check (reviewer_id = auth.uid());

drop policy if exists "reviewers can delete own asset reviews" on public.asset_reviews;
create policy "reviewers can delete own asset reviews"
on public.asset_reviews
for delete
using (reviewer_id = auth.uid());

drop policy if exists "creator reviews are public" on public.creator_reviews;
create policy "creator reviews are public"
on public.creator_reviews
for select
using (true);

drop policy if exists "buyers can insert creator reviews" on public.creator_reviews;
create policy "buyers can insert creator reviews"
on public.creator_reviews
for insert
with check (
  auth.uid() = reviewer_id
  and creator_id <> auth.uid()
  and exists (
    select 1
    from public.orders o
    join public.assets a on a.id = o.asset_id
    where a.creator_id = creator_id
      and o.status = 'paid'
      and (
        o.buyer_id = auth.uid()
        or o.email = (auth.jwt() ->> 'email')
      )
  )
);

drop policy if exists "reviewers can update own creator reviews" on public.creator_reviews;
create policy "reviewers can update own creator reviews"
on public.creator_reviews
for update
using (reviewer_id = auth.uid())
with check (reviewer_id = auth.uid());

drop policy if exists "reviewers can delete own creator reviews" on public.creator_reviews;
create policy "reviewers can delete own creator reviews"
on public.creator_reviews
for delete
using (reviewer_id = auth.uid());

drop policy if exists "users can read own wishlist" on public.wishlists;
create policy "users can read own wishlist"
on public.wishlists
for select
using (user_id = auth.uid());

drop policy if exists "users can insert own wishlist" on public.wishlists;
create policy "users can insert own wishlist"
on public.wishlists
for insert
with check (user_id = auth.uid());

drop policy if exists "users can delete own wishlist" on public.wishlists;
create policy "users can delete own wishlist"
on public.wishlists
for delete
using (user_id = auth.uid());

drop policy if exists "creator follows are public" on public.creator_follows;
create policy "creator follows are public"
on public.creator_follows
for select
using (true);

drop policy if exists "users can follow creators" on public.creator_follows;
create policy "users can follow creators"
on public.creator_follows
for insert
with check (follower_id = auth.uid() and follower_id <> creator_id);

drop policy if exists "users can unfollow creators" on public.creator_follows;
create policy "users can unfollow creators"
on public.creator_follows
for delete
using (follower_id = auth.uid());

drop policy if exists "users can read own release notifications" on public.creator_release_notifications;
create policy "users can read own release notifications"
on public.creator_release_notifications
for select
using (follower_id = auth.uid());

drop policy if exists "users can update own release notifications" on public.creator_release_notifications;
create policy "users can update own release notifications"
on public.creator_release_notifications
for update
using (follower_id = auth.uid())
with check (follower_id = auth.uid());

drop policy if exists "creators can read own analytics events" on public.analytics_events;
create policy "creators can read own analytics events"
on public.analytics_events
for select
using (
  creator_id = auth.uid()
  or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
);

drop policy if exists "clients can insert analytics events" on public.analytics_events;
create policy "clients can insert analytics events"
on public.analytics_events
for insert
with check (
  event_name in ('asset_view', 'asset_click', 'checkout_start')
  and asset_id is not null
  and creator_id is not null
  and (actor_user_id is null or actor_user_id = auth.uid())
);

notify pgrst, 'reload schema';
