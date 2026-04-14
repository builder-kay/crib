-- Demo creative asset marketplace seed data.
-- Safe to run multiple times after migrations.
--
-- Seeded auth users all use the same password:
--   SeedPassword123!
--
-- Notes:
-- - `asset_files.storage_path` values are placeholders for demo catalog data.
-- - Audio listings include public preview URLs so the on-page player works immediately.
-- - Upload matching files into the `assets` bucket if you want download links to resolve to real files.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  seed.id,
  'authenticated',
  'authenticated',
  seed.email,
  crypt('SeedPassword123!', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('display_name', seed.display_name, 'avatar_url', seed.avatar_url),
  now(),
  now(),
  '',
  '',
  '',
  ''
from (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'adjoa.templates@example.com', 'Adjoa Mensah', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'lilian.templates@example.com', 'Lilian Wekesa', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=500&q=80'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'banele.templates@example.com', 'Banele Khumalo', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80'),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'tosin.templates@example.com', 'Tosin Adebayo', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80'),
    ('77777777-7777-4777-8777-777777777777'::uuid, 'kojo.beats@example.com', 'Kojo Beatlab', 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=500&q=80'),
    ('55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', 'Amina Bello', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=80'),
    ('66666666-6666-4666-8666-666666666666'::uuid, 'david.buyer@example.com', 'David Cole', 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=500&q=80')
) as seed(id, email, display_name, avatar_url)
on conflict (id) do nothing;

update public.profiles as p
set
  display_name = seed.display_name,
  bio = seed.bio,
  avatar_url = seed.avatar_url,
  creator_category = seed.creator_category,
  niche = seed.niche,
  socials = seed.socials,
  is_verified = seed.is_verified
from (
  values
    (
      '11111111-1111-4111-8111-111111111111'::uuid,
      'Adjoa Mensah',
      'Photoshop and Lightroom creator building campaign kits, portrait looks, and polished social design systems.',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80',
      'Photoshop Templates',
      'Campaign kits and portrait looks',
      '{"website":"https://crib.example/adjoa","instagram":"@adjoa.templates","x":"@adjoacribs"}'::jsonb,
      true
    ),
    (
      '22222222-2222-4222-8222-222222222222'::uuid,
      'Lilian Wekesa',
      'Illustrator-focused brand designer packaging scalable vector systems, logo libraries, and launch-ready Adobe bundles.',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=500&q=80',
      'Illustrator Templates',
      'Brand systems and vector libraries',
      '{"website":"https://crib.example/lilian","instagram":"@lilianvectors","x":"@liliancrib"}'::jsonb,
      true
    ),
    (
      '33333333-3333-4333-8333-333333333333'::uuid,
      'Banele Khumalo',
      'Motion-first creator shipping After Effects scenes, Premiere title packs, and short-form promo systems.',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80',
      'After Effects Templates',
      'Motion scenes and promo titles',
      '{"website":"https://crib.example/banele","instagram":"@banelemotion","x":"@banelemotion"}'::jsonb,
      true
    ),
    (
      '44444444-4444-4444-8444-444444444444'::uuid,
      'Tosin Adebayo',
      'Editorial designer creating InDesign decks, pitch documents, and polished presentation systems for agencies and startups.',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80',
      'InDesign Templates',
      'Pitch decks and editorial layouts',
      '{"website":"https://crib.example/tosin","instagram":"@tosindesigns","x":"@tosinlayouts"}'::jsonb,
      false
    ),
    (
      '77777777-7777-4777-8777-777777777777'::uuid,
      'Kojo Beatlab',
      'Producer building editable afrobeats, amapiano, and gospel packs with stems, MIDI, and clean DAW sessions for fast custom work.',
      'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=500&q=80',
      'Music Producer',
      'Editable beats, stems, and DAW sessions',
      '{"website":"https://crib.example/kojo","instagram":"@kojobeatlab","x":"@kojobeatlab"}'::jsonb,
      true
    ),
    (
      '55555555-5555-4555-8555-555555555555'::uuid,
      'Amina Bello',
      'Buyer account for local marketplace testing.',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=80',
      'Buyer',
      'Template buyer',
      '{"website":"","instagram":"@amina.bello","x":"@aminabuys"}'::jsonb,
      false
    ),
    (
      '66666666-6666-4666-8666-666666666666'::uuid,
      'David Cole',
      'Buyer account for reviews, wishlists, and follow activity.',
      'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=500&q=80',
      'Buyer',
      'Template buyer',
      '{"website":"","instagram":"@davidcollects","x":"@davidcollects"}'::jsonb,
      false
    )
) as seed(id, display_name, bio, avatar_url, creator_category, niche, socials, is_verified)
where p.id = seed.id;

insert into public.creator_payout_accounts (
  creator_id,
  provider,
  status,
  country,
  payout_type,
  business_name,
  subaccount_code,
  settlement_bank_code,
  settlement_bank_name,
  account_number_last4,
  account_name,
  metadata
)
values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'paystack', 'active', 'ghana', 'bank', 'Adjoa Studio', 'CRIBSEED_ADJOA', '000', 'Seed Test Bank', '1111', 'Adjoa Mensah', '{"test_mode":true}'::jsonb),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'paystack', 'active', 'kenya', 'bank', 'Lilian Vector Works', 'CRIBSEED_LILIAN', '000', 'Seed Test Bank', '2222', 'Lilian Wekesa', '{"test_mode":true}'::jsonb),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'paystack', 'active', 'south_africa', 'bank', 'Banele Motion Lab', 'CRIBSEED_BANELE', '000', 'Seed Test Bank', '3333', 'Banele Khumalo', '{"test_mode":true}'::jsonb),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'paystack', 'active', 'nigeria', 'bank', 'Tosin Layout Studio', 'CRIBSEED_TOSIN', '000', 'Seed Test Bank', '4444', 'Tosin Adebayo', '{"test_mode":true}'::jsonb),
  ('77777777-7777-4777-8777-777777777777'::uuid, 'paystack', 'active', 'ghana', 'bank', 'Kojo Beatlab', 'CRIBSEED_KOJO', '000', 'Seed Test Bank', '7777', 'Kojo Beatlab', '{"test_mode":true}'::jsonb)
on conflict (creator_id) do update
set
  status = excluded.status,
  payout_type = excluded.payout_type,
  business_name = excluded.business_name,
  subaccount_code = excluded.subaccount_code,
  settlement_bank_code = excluded.settlement_bank_code,
  settlement_bank_name = excluded.settlement_bank_name,
  account_number_last4 = excluded.account_number_last4,
  account_name = excluded.account_name,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.creator_follows (follower_id, creator_id, created_at)
values
  ('55555555-5555-4555-8555-555555555555'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, now() - interval '9 days'),
  ('55555555-5555-4555-8555-555555555555'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, now() - interval '8 days'),
  ('55555555-5555-4555-8555-555555555555'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, now() - interval '7 days'),
  ('55555555-5555-4555-8555-555555555555'::uuid, '77777777-7777-4777-8777-777777777777'::uuid, now() - interval '4 days'),
  ('66666666-6666-4666-8666-666666666666'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, now() - interval '6 days'),
  ('66666666-6666-4666-8666-666666666666'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, now() - interval '5 days'),
  ('66666666-6666-4666-8666-666666666666'::uuid, '77777777-7777-4777-8777-777777777777'::uuid, now() - interval '3 days')
on conflict do nothing;

insert into public.assets (
  id,
  creator_id,
  title,
  description,
  category,
  tags,
  price_kobo,
  minimum_price_kobo,
  currency,
  delivery_mode,
  pricing_model,
  status,
  created_at,
  updated_at
)
values
  (
    'aaaa1111-1111-4111-8111-111111111111'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'Afro Event Flyer Kit',
    'A layered Photoshop flyer template pack for concerts, launch nights, and promotional campaigns with smart objects, editable text, and social crops.',
    'Photoshop Templates',
    array['photoshop', 'flyer', 'event', 'smart objects', 'social kit'],
    18000,
    18000,
    'GHS',
    'file',
    'paid',
    'published',
    now() - interval '18 days',
    now() - interval '18 days'
  ),
  (
    'aaaa2222-2222-4222-8222-222222222222'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    'Golden Hour Portrait Presets',
    'A Lightroom preset collection tuned for warm skin tones, outdoor portrait work, and creator-led editorial photography.',
    'Lightroom Presets',
    array['lightroom', 'preset', 'portrait', 'warm tones', 'photography'],
    12000,
    12000,
    'GHS',
    'file',
    'paid',
    'published',
    now() - interval '15 days',
    now() - interval '15 days'
  ),
  (
    'bbbb1111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'Kente Brand Vector Library',
    'An Illustrator-based brand template system with logo lockups, icon shapes, poster compositions, and packaging-ready vector assets.',
    'Illustrator Templates',
    array['illustrator', 'branding', 'logo', 'vector', 'packaging'],
    22000,
    22000,
    'GHS',
    'file',
    'paid',
    'published',
    now() - interval '14 days',
    now() - interval '14 days'
  ),
  (
    'bbbb2222-2222-4222-8222-222222222222'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'Agency Launch Bundle',
    'A cross-app Creative Cloud bundle including Photoshop mockups, Illustrator brand assets, and InDesign presentation pages for fast client launches.',
    'Creative Cloud Bundles',
    array['bundle', 'creative cloud', 'agency', 'branding', 'launch'],
    32000,
    32000,
    'GHS',
    'file',
    'paid',
    'published',
    now() - interval '11 days',
    now() - interval '11 days'
  ),
  (
    'cccc1111-1111-4111-8111-111111111111'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid,
    'Pulse Opener Scenes',
    'A fast-cut After Effects template pack with bold typography, logo reveal scenes, and motion backgrounds built for promo edits.',
    'After Effects Templates',
    array['after effects', 'opener', 'motion', 'logo reveal', 'promo'],
    26000,
    26000,
    'GHS',
    'file',
    'paid',
    'published',
    now() - interval '10 days',
    now() - interval '10 days'
  ),
  (
    'cccc2222-2222-4222-8222-222222222222'::uuid,
    '33333333-3333-4333-8333-333333333333'::uuid,
    'Reel Promo Titles Pack',
    'A Premiere Pro template set for social reels, launch edits, and creator promos with editable captions, intros, and transitions.',
    'Premiere Pro Templates',
    array['premiere pro', 'reels', 'titles', 'captions', 'promo'],
    24000,
    24000,
    'GHS',
    'file',
    'paid',
    'published',
    now() - interval '8 days',
    now() - interval '8 days'
  ),
  (
    'dddd1111-1111-4111-8111-111111111111'::uuid,
    '44444444-4444-4444-8444-444444444444'::uuid,
    'Creator Media Kit Deck',
    'An InDesign media kit and pitch deck template for creators, agencies, and consultants who need a polished sponsorship-ready presentation.',
    'InDesign Templates',
    array['indesign', 'media kit', 'deck', 'pitch', 'presentation'],
    28000,
    28000,
    'GHS',
    'file',
    'paid',
    'published',
    now() - interval '6 days',
    now() - interval '6 days'
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  tags = excluded.tags,
  price_kobo = excluded.price_kobo,
  minimum_price_kobo = excluded.minimum_price_kobo,
  currency = excluded.currency,
  delivery_mode = excluded.delivery_mode,
  pricing_model = excluded.pricing_model,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into public.assets (
  id,
  creator_id,
  title,
  description,
  category,
  tags,
  price_kobo,
  minimum_price_kobo,
  currency,
  delivery_mode,
  pricing_model,
  audio_preview_url,
  audio_genre,
  audio_bpm,
  audio_key,
  license_options,
  status,
  created_at,
  updated_at
)
values
  (
    'eeee1111-1111-4111-8111-111111111111'::uuid,
    '77777777-7777-4777-8777-777777777777'::uuid,
    'Lagos Night Drive Beat Pack',
    'An editable afrobeats production pack with bounced stems, MIDI chords, and an Ableton session bundled into one ZIP for fast remixing or topline work.',
    'Audio / Beats',
    array['afrobeats', 'stems', 'ableton', 'midi', 'editable audio'],
    22000,
    22000,
    'GHS',
    'file',
    'paid',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'Afrobeats',
    108,
    'F Minor',
    array['personal_use', 'commercial_use']::text[],
    'published',
    now() - interval '4 days',
    now() - interval '4 days'
  ),
  (
    'eeee2222-2222-4222-8222-222222222222'::uuid,
    '77777777-7777-4777-8777-777777777777'::uuid,
    'Sunday Lift Gospel Stems',
    'A gospel-first beat suite with organ, choir, bass, and drum stems bundled with FL Studio project files and MIDI in one ZIP for easy rearrangement or custom production work.',
    'Audio / Beats',
    array['gospel', 'fl studio', 'stems', 'midi', 'choir'],
    30000,
    15000,
    'GHS',
    'file',
    'pay_what_you_want',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'Gospel',
    74,
    'C Major',
    array['personal_use', 'commercial_use', 'exclusive_rights']::text[],
    'published',
    now() - interval '2 days',
    now() - interval '2 days'
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  tags = excluded.tags,
  price_kobo = excluded.price_kobo,
  minimum_price_kobo = excluded.minimum_price_kobo,
  currency = excluded.currency,
  delivery_mode = excluded.delivery_mode,
  pricing_model = excluded.pricing_model,
  audio_preview_url = excluded.audio_preview_url,
  audio_genre = excluded.audio_genre,
  audio_bpm = excluded.audio_bpm,
  audio_key = excluded.audio_key,
  license_options = excluded.license_options,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into public.asset_files (
  id,
  asset_id,
  storage_path,
  file_type,
  file_size,
  original_name,
  created_at
)
values
  ('faaa1111-1111-4111-8111-111111111111'::uuid, 'aaaa1111-1111-4111-8111-111111111111'::uuid, 'seed/11111111-1111-4111-8111-111111111111/aaaa1111-1111-4111-8111-111111111111/afro-event-flyer-kit.psd', 'application/octet-stream', 52428800, 'afro-event-flyer-kit.psd', now() - interval '18 days'),
  ('faaa2222-2222-4222-8222-222222222222'::uuid, 'aaaa2222-2222-4222-8222-222222222222'::uuid, 'seed/11111111-1111-4111-8111-111111111111/aaaa2222-2222-4222-8222-222222222222/golden-hour-portrait-presets.xmp', 'application/octet-stream', 1048576, 'golden-hour-portrait-presets.xmp', now() - interval '15 days'),
  ('fbbb1111-1111-4111-8111-111111111111'::uuid, 'bbbb1111-1111-4111-8111-111111111111'::uuid, 'seed/22222222-2222-4222-8222-222222222222/bbbb1111-1111-4111-8111-111111111111/kente-brand-vector-library.ai', 'application/octet-stream', 31457280, 'kente-brand-vector-library.ai', now() - interval '14 days'),
  ('fbbb2222-2222-4222-8222-222222222222'::uuid, 'bbbb2222-2222-4222-8222-222222222222'::uuid, 'seed/22222222-2222-4222-8222-222222222222/bbbb2222-2222-4222-8222-222222222222/agency-launch-bundle.zip', 'application/zip', 125829120, 'agency-launch-bundle.zip', now() - interval '11 days'),
  ('fccc1111-1111-4111-8111-111111111111'::uuid, 'cccc1111-1111-4111-8111-111111111111'::uuid, 'seed/33333333-3333-4333-8333-333333333333/cccc1111-1111-4111-8111-111111111111/pulse-opener-scenes.aep', 'application/octet-stream', 73400320, 'pulse-opener-scenes.aep', now() - interval '10 days'),
  ('fccc2222-2222-4222-8222-222222222222'::uuid, 'cccc2222-2222-4222-8222-222222222222'::uuid, 'seed/33333333-3333-4333-8333-333333333333/cccc2222-2222-4222-8222-222222222222/reel-promo-titles.prproj', 'application/octet-stream', 41943040, 'reel-promo-titles.prproj', now() - interval '8 days'),
  ('fddd1111-1111-4111-8111-111111111111'::uuid, 'dddd1111-1111-4111-8111-111111111111'::uuid, 'seed/44444444-4444-4444-8444-444444444444/dddd1111-1111-4111-8111-111111111111/creator-media-kit-deck.indd', 'application/octet-stream', 26214400, 'creator-media-kit-deck.indd', now() - interval '6 days')
on conflict (id) do update
set
  storage_path = excluded.storage_path,
  file_type = excluded.file_type,
  file_size = excluded.file_size,
  original_name = excluded.original_name;

delete from public.asset_files
where asset_id in (
  'eeee1111-1111-4111-8111-111111111111'::uuid,
  'eeee2222-2222-4222-8222-222222222222'::uuid
);

insert into public.asset_files (
  id,
  asset_id,
  storage_path,
  file_type,
  file_size,
  original_name,
  file_role,
  sort_order,
  created_at
)
values
  ('feee1113-1111-4111-8111-111111111113'::uuid, 'eeee1111-1111-4111-8111-111111111111'::uuid, 'seed/77777777-7777-4777-8777-777777777777/eeee1111-1111-4111-8111-111111111111/lagos-night-drive-stems-and-project.zip', 'application/zip', 157286400, 'lagos-night-drive-stems-and-project.zip', 'source_zip', 0, now() - interval '4 days'),
  ('feee2223-2222-4222-8222-222222222223'::uuid, 'eeee2222-2222-4222-8222-222222222222'::uuid, 'seed/77777777-7777-4777-8777-777777777777/eeee2222-2222-4222-8222-222222222222/sunday-lift-stems-and-project.zip', 'application/zip', 146800640, 'sunday-lift-stems-and-project.zip', 'source_zip', 0, now() - interval '2 days')
on conflict (id) do update
set
  storage_path = excluded.storage_path,
  file_type = excluded.file_type,
  file_size = excluded.file_size,
  original_name = excluded.original_name,
  file_role = excluded.file_role,
  sort_order = excluded.sort_order;

insert into public.asset_previews (
  id,
  asset_id,
  preview_url,
  created_at
)
values
  ('3aaa1111-1111-4111-8111-111111111111'::uuid, 'aaaa1111-1111-4111-8111-111111111111'::uuid, 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80', now() - interval '18 days'),
  ('3aaa1112-1111-4111-8111-111111111112'::uuid, 'aaaa1111-1111-4111-8111-111111111111'::uuid, 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', now() - interval '18 days'),
  ('3aaa2221-2222-4222-8222-222222222221'::uuid, 'aaaa2222-2222-4222-8222-222222222222'::uuid, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80', now() - interval '15 days'),
  ('3bbb1111-1111-4111-8111-111111111111'::uuid, 'bbbb1111-1111-4111-8111-111111111111'::uuid, 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80', now() - interval '14 days'),
  ('3bbb2221-2222-4222-8222-222222222221'::uuid, 'bbbb2222-2222-4222-8222-222222222222'::uuid, 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1200&q=80', now() - interval '11 days'),
  ('3ccc1111-1111-4111-8111-111111111111'::uuid, 'cccc1111-1111-4111-8111-111111111111'::uuid, 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80', now() - interval '10 days'),
  ('3ccc2221-2222-4222-8222-222222222221'::uuid, 'cccc2222-2222-4222-8222-222222222222'::uuid, 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80', now() - interval '8 days'),
  ('3ddd1111-1111-4111-8111-111111111111'::uuid, 'dddd1111-1111-4111-8111-111111111111'::uuid, 'https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=1200&q=80', now() - interval '6 days')
on conflict (id) do update
set
  preview_url = excluded.preview_url;

insert into public.asset_previews (
  id,
  asset_id,
  preview_url,
  created_at
)
values
  ('3eee1111-1111-4111-8111-111111111111'::uuid, 'eeee1111-1111-4111-8111-111111111111'::uuid, 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80', now() - interval '4 days'),
  ('3eee1112-1111-4111-8111-111111111112'::uuid, 'eeee1111-1111-4111-8111-111111111111'::uuid, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80', now() - interval '4 days'),
  ('3eee2221-2222-4222-8222-222222222221'::uuid, 'eeee2222-2222-4222-8222-222222222222'::uuid, 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80', now() - interval '2 days'),
  ('3eee2222-2222-4222-8222-222222222222'::uuid, 'eeee2222-2222-4222-8222-222222222222'::uuid, 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80', now() - interval '2 days')
on conflict (id) do update
set
  preview_url = excluded.preview_url;

insert into public.orders (
  id,
  buyer_id,
  email,
  email_token,
  asset_id,
  amount_kobo,
  currency,
  status,
  created_at,
  paid_at
)
values
  ('0aaa1111-1111-4111-8111-111111111111'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', '9a0cc6eb-4c4a-4a66-8d7e-3a46d6350001'::uuid, 'aaaa1111-1111-4111-8111-111111111111'::uuid, 18000, 'GHS', 'paid', now() - interval '5 days', now() - interval '5 days' + interval '20 minutes'),
  ('0bbb1111-1111-4111-8111-111111111111'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 'david.buyer@example.com', '9a0cc6eb-4c4a-4a66-8d7e-3a46d6350002'::uuid, 'bbbb2222-2222-4222-8222-222222222222'::uuid, 32000, 'GHS', 'paid', now() - interval '4 days', now() - interval '4 days' + interval '14 minutes'),
  ('0ccc1111-1111-4111-8111-111111111111'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', '9a0cc6eb-4c4a-4a66-8d7e-3a46d6350003'::uuid, 'cccc2222-2222-4222-8222-222222222222'::uuid, 24000, 'GHS', 'paid', now() - interval '3 days', now() - interval '3 days' + interval '9 minutes'),
  ('0ddd1111-1111-4111-8111-111111111111'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 'david.buyer@example.com', '9a0cc6eb-4c4a-4a66-8d7e-3a46d6350004'::uuid, 'dddd1111-1111-4111-8111-111111111111'::uuid, 28000, 'GHS', 'paid', now() - interval '2 days', now() - interval '2 days' + interval '11 minutes'),
  ('0eee1111-1111-4111-8111-111111111111'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', '9a0cc6eb-4c4a-4a66-8d7e-3a46d6350005'::uuid, 'aaaa2222-2222-4222-8222-222222222222'::uuid, 12000, 'GHS', 'pending', now() - interval '12 hours', null)
on conflict (id) do update
set
  buyer_id = excluded.buyer_id,
  email = excluded.email,
  email_token = excluded.email_token,
  asset_id = excluded.asset_id,
  amount_kobo = excluded.amount_kobo,
  currency = excluded.currency,
  status = excluded.status,
  created_at = excluded.created_at,
  paid_at = excluded.paid_at;

insert into public.payments (
  id,
  order_id,
  provider,
  reference,
  status,
  raw,
  created_at,
  updated_at
)
values
  ('1aaa1111-1111-4111-8111-111111111111'::uuid, '0aaa1111-1111-4111-8111-111111111111'::uuid, 'paystack', 'seed-paystack-order-1', 'paid', '{"channel":"card","test_mode":true}'::jsonb, now() - interval '5 days', now() - interval '5 days'),
  ('1bbb1111-1111-4111-8111-111111111111'::uuid, '0bbb1111-1111-4111-8111-111111111111'::uuid, 'paystack', 'seed-paystack-order-2', 'paid', '{"channel":"card","test_mode":true}'::jsonb, now() - interval '4 days', now() - interval '4 days'),
  ('1ccc1111-1111-4111-8111-111111111111'::uuid, '0ccc1111-1111-4111-8111-111111111111'::uuid, 'paystack', 'seed-paystack-order-3', 'paid', '{"channel":"bank_transfer","test_mode":true}'::jsonb, now() - interval '3 days', now() - interval '3 days'),
  ('1ddd1111-1111-4111-8111-111111111111'::uuid, '0ddd1111-1111-4111-8111-111111111111'::uuid, 'paystack', 'seed-paystack-order-4', 'paid', '{"channel":"card","test_mode":true}'::jsonb, now() - interval '2 days', now() - interval '2 days')
on conflict (id) do update
set
  order_id = excluded.order_id,
  provider = excluded.provider,
  reference = excluded.reference,
  status = excluded.status,
  raw = excluded.raw,
  updated_at = excluded.updated_at;

insert into public.wallet_tx (
  id,
  creator_id,
  order_id,
  type,
  amount_kobo,
  created_at
)
values
  ('2aaa1111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, '0aaa1111-1111-4111-8111-111111111111'::uuid, 'credit', 18000, now() - interval '5 days'),
  ('2bbb1111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, '0bbb1111-1111-4111-8111-111111111111'::uuid, 'credit', 32000, now() - interval '4 days'),
  ('2ccc1111-1111-4111-8111-111111111111'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, '0ccc1111-1111-4111-8111-111111111111'::uuid, 'credit', 24000, now() - interval '3 days'),
  ('2ddd1111-1111-4111-8111-111111111111'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, '0ddd1111-1111-4111-8111-111111111111'::uuid, 'credit', 28000, now() - interval '2 days')
on conflict (order_id, type) do update
set
  creator_id = excluded.creator_id,
  amount_kobo = excluded.amount_kobo,
  created_at = excluded.created_at;

update public.wallet as w
set
  balance_kobo = balances.balance_kobo,
  updated_at = now()
from (
  select
    creator_id,
    coalesce(sum(amount_kobo), 0)::bigint as balance_kobo
  from public.wallet_tx
  where type = 'credit'
  group by creator_id
) as balances
where w.creator_id = balances.creator_id;

insert into public.wishlists (user_id, asset_id, created_at)
values
  ('55555555-5555-4555-8555-555555555555'::uuid, 'bbbb2222-2222-4222-8222-222222222222'::uuid, now() - interval '4 days'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'dddd1111-1111-4111-8111-111111111111'::uuid, now() - interval '3 days'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'eeee1111-1111-4111-8111-111111111111'::uuid, now() - interval '36 hours'),
  ('66666666-6666-4666-8666-666666666666'::uuid, 'aaaa1111-1111-4111-8111-111111111111'::uuid, now() - interval '2 days'),
  ('66666666-6666-4666-8666-666666666666'::uuid, 'cccc2222-2222-4222-8222-222222222222'::uuid, now() - interval '1 day'),
  ('66666666-6666-4666-8666-666666666666'::uuid, 'eeee2222-2222-4222-8222-222222222222'::uuid, now() - interval '18 hours')
on conflict do nothing;

insert into public.asset_reviews (
  id,
  asset_id,
  reviewer_id,
  rating,
  review_text,
  created_at,
  updated_at
)
values
  ('4aaa1111-1111-4111-8111-111111111111'::uuid, 'aaaa1111-1111-4111-8111-111111111111'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 5, 'Loved the layering and the smart objects. It was easy to swap images and export multiple sizes.', now() - interval '4 days', now() - interval '4 days'),
  ('4bbb1111-1111-4111-8111-111111111111'::uuid, 'bbbb2222-2222-4222-8222-222222222222'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 5, 'Excellent bundle for fast client work. The file organization is clear and the templates feel premium.', now() - interval '3 days', now() - interval '3 days'),
  ('4ccc1111-1111-4111-8111-111111111111'::uuid, 'cccc2222-2222-4222-8222-222222222222'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 4, 'Strong title pack for reels and short promos. Easy to adapt for different aspect ratios.', now() - interval '2 days', now() - interval '2 days'),
  ('4ddd1111-1111-4111-8111-111111111111'::uuid, 'dddd1111-1111-4111-8111-111111111111'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 5, 'The deck structure is clean and saves a lot of prep time before sponsorship outreach.', now() - interval '1 day', now() - interval '1 day'),
  ('4eee1111-1111-4111-8111-111111111111'::uuid, 'eeee1111-1111-4111-8111-111111111111'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 5, 'The stems are clean and the Ableton session made it easy to flip the groove for a client cut.', now() - interval '28 hours', now() - interval '28 hours'),
  ('4eee2222-2222-4222-8222-222222222222'::uuid, 'eeee2222-2222-4222-8222-222222222222'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 4, 'Great church-ready progression and useful MIDI. The editable files were organized well and fast to open.', now() - interval '16 hours', now() - interval '16 hours')
on conflict (asset_id, reviewer_id) do update
set
  rating = excluded.rating,
  review_text = excluded.review_text,
  updated_at = excluded.updated_at;

insert into public.creator_reviews (
  id,
  creator_id,
  reviewer_id,
  rating,
  review_text,
  created_at,
  updated_at
)
values
  ('caaa1111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 5, 'Fast support, polished files, and very strong presentation quality.', now() - interval '3 days', now() - interval '3 days'),
  ('cbbb1111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 5, 'Great vector quality and consistent naming throughout the pack.', now() - interval '2 days', now() - interval '2 days'),
  ('cccc1111-1111-4111-8111-111111111111'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 4, 'Motion templates are well organized and easy to customize without digging for assets.', now() - interval '1 day', now() - interval '1 day'),
  ('ceee1111-1111-4111-8111-111111111111'::uuid, '77777777-7777-4777-8777-777777777777'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 5, 'Strong pack organization and clearly labeled editable audio files throughout the delivery.', now() - interval '20 hours', now() - interval '20 hours')
on conflict (creator_id, reviewer_id) do update
set
  rating = excluded.rating,
  review_text = excluded.review_text,
  updated_at = excluded.updated_at;

insert into public.creator_release_notifications (
  creator_id,
  follower_id,
  asset_id,
  channel,
  delivery_status,
  created_at
)
select
  a.creator_id,
  cf.follower_id,
  a.id,
  'in_app',
  'pending',
  a.created_at
from public.assets a
join public.creator_follows cf on cf.creator_id = a.creator_id
where a.id in (
  'aaaa1111-1111-4111-8111-111111111111'::uuid,
  'aaaa2222-2222-4222-8222-222222222222'::uuid,
  'bbbb1111-1111-4111-8111-111111111111'::uuid,
  'bbbb2222-2222-4222-8222-222222222222'::uuid,
  'cccc1111-1111-4111-8111-111111111111'::uuid,
  'cccc2222-2222-4222-8222-222222222222'::uuid,
  'dddd1111-1111-4111-8111-111111111111'::uuid,
  'eeee1111-1111-4111-8111-111111111111'::uuid,
  'eeee2222-2222-4222-8222-222222222222'::uuid
)
on conflict do nothing;

insert into public.analytics_events (
  id,
  event_name,
  asset_id,
  creator_id,
  order_id,
  actor_user_id,
  actor_email,
  session_id,
  metadata,
  occurred_at
)
values
  ('eaaa1111-1111-4111-8111-111111111111'::uuid, 'asset_view', 'aaaa1111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, null, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', 'seed-session-amina-1', '{"page":"market"}'::jsonb, now() - interval '2 days'),
  ('eaaa2222-2222-4222-8222-222222222222'::uuid, 'asset_click', 'aaaa1111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, null, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', 'seed-session-amina-1', '{"surface":"title"}'::jsonb, now() - interval '2 days' + interval '5 minutes'),
  ('eaaa3333-3333-4333-8333-333333333333'::uuid, 'purchase', 'aaaa1111-1111-4111-8111-111111111111'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, '0aaa1111-1111-4111-8111-111111111111'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', 'seed-session-amina-1', '{"provider":"paystack"}'::jsonb, now() - interval '5 days' + interval '20 minutes'),
  ('ebbb1111-1111-4111-8111-111111111111'::uuid, 'checkout_start', 'bbbb2222-2222-4222-8222-222222222222'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, null, '66666666-6666-4666-8666-666666666666'::uuid, 'david.buyer@example.com', 'seed-session-david-1', '{"page":"asset_detail"}'::jsonb, now() - interval '36 hours'),
  ('ebbb2222-2222-4222-8222-222222222222'::uuid, 'purchase', 'bbbb2222-2222-4222-8222-222222222222'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, '0bbb1111-1111-4111-8111-111111111111'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 'david.buyer@example.com', 'seed-session-david-1', '{"provider":"paystack"}'::jsonb, now() - interval '4 days' + interval '14 minutes'),
  ('eccc1111-1111-4111-8111-111111111111'::uuid, 'asset_view', 'cccc2222-2222-4222-8222-222222222222'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, null, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', 'seed-session-amina-2', '{"page":"market"}'::jsonb, now() - interval '1 day'),
  ('eccc2222-2222-4222-8222-222222222222'::uuid, 'asset_click', 'cccc2222-2222-4222-8222-222222222222'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, null, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', 'seed-session-amina-2', '{"surface":"cta"}'::jsonb, now() - interval '1 day' + interval '8 minutes'),
  ('eccc3333-3333-4333-8333-333333333333'::uuid, 'purchase', 'cccc2222-2222-4222-8222-222222222222'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, '0ccc1111-1111-4111-8111-111111111111'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 'amina.buyer@example.com', 'seed-session-amina-2', '{"provider":"paystack"}'::jsonb, now() - interval '3 days' + interval '9 minutes'),
  ('eddd1111-1111-4111-8111-111111111111'::uuid, 'asset_view', 'dddd1111-1111-4111-8111-111111111111'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, null, '66666666-6666-4666-8666-666666666666'::uuid, 'david.buyer@example.com', 'seed-session-david-2', '{"page":"asset_detail"}'::jsonb, now() - interval '18 hours'),
  ('eddd2222-2222-4222-8222-222222222222'::uuid, 'checkout_start', 'dddd1111-1111-4111-8111-111111111111'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, null, '66666666-6666-4666-8666-666666666666'::uuid, 'david.buyer@example.com', 'seed-session-david-2', '{"page":"asset_detail"}'::jsonb, now() - interval '17 hours'),
  ('eddd3333-3333-4333-8333-333333333333'::uuid, 'purchase', 'dddd1111-1111-4111-8111-111111111111'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, '0ddd1111-1111-4111-8111-111111111111'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 'david.buyer@example.com', 'seed-session-david-2', '{"provider":"paystack"}'::jsonb, now() - interval '2 days' + interval '11 minutes')
on conflict do nothing;
