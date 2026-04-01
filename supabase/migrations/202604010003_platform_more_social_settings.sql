alter table public.platform_settings
  add column if not exists linkedin_handle text not null default '',
  add column if not exists facebook_handle text not null default '',
  add column if not exists whatsapp_channel text not null default '';

notify pgrst, 'reload schema';
