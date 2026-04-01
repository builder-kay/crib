alter table public.platform_settings
  add column if not exists support_email text not null default '',
  add column if not exists admin_whatsapp_number text not null default '',
  add column if not exists admin_whatsapp_message text not null default '';

notify pgrst, 'reload schema';
