-- Optional seed data for local development.
-- Run after creating at least one auth user; replace UUIDs with real user IDs.

-- Example: make a user an admin
-- insert into public.admins (user_id)
-- values ('00000000-0000-0000-0000-000000000000')
-- on conflict (user_id) do nothing;

-- Example: publish an uploaded asset manually
-- update public.assets
-- set status = 'published'
-- where id = '00000000-0000-0000-0000-000000000000';