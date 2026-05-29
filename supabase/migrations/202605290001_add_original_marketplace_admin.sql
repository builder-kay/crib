create extension if not exists pgcrypto;

-- Create the initial marketplace admin account.
--
-- Email: adminoriginal@gmail.com
-- Password: #12345678!
--
-- This inserts directly into Supabase Auth for local/self-hosted database
-- migrations, then grants marketplace-admin access through public.admins.
-- If your hosted Supabase project blocks direct auth schema writes, create the
-- user with the Supabase dashboard/Auth Admin API and keep the public.admins
-- upsert below.

do $$
declare
  v_admin_id uuid := '0f6e7f8a-3b72-4cc3-97f1-21db892f7d01'::uuid;
  v_admin_email text := 'adminoriginal@gmail.com';
  v_admin_password text := '#12345678!';
  v_identity_id_type text;
begin
  insert into auth.users (
    id,
    instance_id,
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
  values (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    v_admin_email,
    crypt(v_admin_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Admin Original"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update
  set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  if to_regclass('auth.identities') is not null then
    update auth.identities
    set
      user_id = v_admin_id,
      identity_data = jsonb_build_object(
        'sub', v_admin_id::text,
        'email', v_admin_email,
        'email_verified', true,
        'phone_verified', false
      ),
      updated_at = now()
    where provider = 'email'
      and provider_id = v_admin_email;

    if not found then
      select data_type
      into v_identity_id_type
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'identities'
        and column_name = 'id';

      if v_identity_id_type = 'uuid' then
        insert into auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          provider_id,
          last_sign_in_at,
          created_at,
          updated_at
        )
        values (
          gen_random_uuid(),
          v_admin_id,
          jsonb_build_object(
            'sub', v_admin_id::text,
            'email', v_admin_email,
            'email_verified', true,
            'phone_verified', false
          ),
          'email',
          v_admin_email,
          now(),
          now(),
          now()
        );
      else
        insert into auth.identities (
          id,
          user_id,
          identity_data,
          provider,
          provider_id,
          last_sign_in_at,
          created_at,
          updated_at
        )
        values (
          v_admin_id::text,
          v_admin_id,
          jsonb_build_object(
            'sub', v_admin_id::text,
            'email', v_admin_email,
            'email_verified', true,
            'phone_verified', false
          ),
          'email',
          v_admin_email,
          now(),
          now(),
          now()
        );
      end if;
    end if;
  end if;

  insert into public.profiles (id, display_name)
  values (v_admin_id, 'Admin Original')
  on conflict (id) do update
  set display_name = excluded.display_name;

  insert into public.wallet (creator_id, balance_kobo)
  values (v_admin_id, 0)
  on conflict (creator_id) do nothing;

  insert into public.admins (user_id)
  values (v_admin_id)
  on conflict (user_id) do nothing;
end $$;
