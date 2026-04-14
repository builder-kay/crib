alter table public.assets
  add column if not exists audio_preview_url text,
  add column if not exists audio_genre text,
  add column if not exists audio_bpm integer,
  add column if not exists audio_key text,
  add column if not exists license_options text[] not null default '{}'::text[];

alter table public.assets
  drop constraint if exists assets_license_options_check;

alter table public.assets
  add constraint assets_license_options_check
  check (
    license_options <@ array['personal_use', 'commercial_use', 'exclusive_rights']::text[]
  );

alter table public.assets
  drop constraint if exists assets_audio_bpm_check;

alter table public.assets
  add constraint assets_audio_bpm_check
  check (audio_bpm is null or (audio_bpm >= 1 and audio_bpm <= 400));

alter table public.assets
  drop constraint if exists assets_audio_listing_required_check;

alter table public.assets
  add constraint assets_audio_listing_required_check
  check (
    category <> 'Audio / Beats'
    or (
      delivery_mode = 'file'
      and nullif(btrim(coalesce(audio_preview_url, '')), '') is not null
      and nullif(btrim(coalesce(audio_genre, '')), '') is not null
      and audio_bpm is not null
      and nullif(btrim(coalesce(audio_key, '')), '') is not null
      and coalesce(array_length(license_options, 1), 0) >= 1
    )
  );

create index if not exists assets_license_options_gin_idx on public.assets using gin (license_options);
create index if not exists assets_audio_genre_idx on public.assets (audio_genre) where category = 'Audio / Beats';

alter table public.asset_files
  add column if not exists file_role text not null default 'primary',
  add column if not exists sort_order integer not null default 0;

alter table public.asset_files
  drop constraint if exists asset_files_file_role_check;

alter table public.asset_files
  add constraint asset_files_file_role_check
  check (
    file_role in ('primary', 'audio_preview', 'source_wav', 'source_zip', 'project_file', 'midi', 'supporting')
  );

alter table public.asset_files
  drop constraint if exists asset_files_sort_order_check;

alter table public.asset_files
  add constraint asset_files_sort_order_check
  check (sort_order >= 0);

create table if not exists public.order_delivery_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  asset_file_id uuid references public.asset_files (id) on delete set null,
  file_role text not null default 'primary',
  sort_order integer not null default 0,
  storage_path text not null,
  original_name text not null,
  file_type text not null,
  file_size bigint not null check (file_size >= 0),
  file_sha256 text not null,
  locked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.order_delivery_files
  drop constraint if exists order_delivery_files_file_role_check;

alter table public.order_delivery_files
  add constraint order_delivery_files_file_role_check
  check (
    file_role in ('primary', 'audio_preview', 'source_wav', 'source_zip', 'project_file', 'midi', 'supporting')
  );

alter table public.order_delivery_files
  drop constraint if exists order_delivery_files_sort_order_check;

alter table public.order_delivery_files
  add constraint order_delivery_files_sort_order_check
  check (sort_order >= 0);

alter table public.order_delivery_files
  drop constraint if exists order_delivery_files_file_sha256_check;

alter table public.order_delivery_files
  add constraint order_delivery_files_file_sha256_check
  check (file_sha256 ~ '^[0-9a-f]{64}$');

create index if not exists order_delivery_files_order_id_idx on public.order_delivery_files (order_id);
create index if not exists order_delivery_files_asset_file_id_idx on public.order_delivery_files (asset_file_id);
create unique index if not exists order_delivery_files_order_path_idx on public.order_delivery_files (order_id, storage_path);
create unique index if not exists order_delivery_files_order_asset_file_idx on public.order_delivery_files (order_id, asset_file_id);

alter table public.order_delivery_files enable row level security;

drop policy if exists "buyers creators and admins can read order delivery files" on public.order_delivery_files;

create policy "buyers creators and admins can read order delivery files"
on public.order_delivery_files
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_delivery_files.order_id
      and (
        o.buyer_id = auth.uid()
        or o.email = (auth.jwt() ->> 'email')
        or exists (
          select 1
          from public.assets a
          where a.id = o.asset_id
            and a.creator_id = auth.uid()
        )
        or exists (select 1 from public.admins ad where ad.user_id = auth.uid())
      )
  )
);

notify pgrst, 'reload schema';
