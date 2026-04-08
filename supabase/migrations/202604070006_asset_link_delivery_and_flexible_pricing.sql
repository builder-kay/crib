alter table public.assets
  add column if not exists delivery_mode text not null default 'file',
  add column if not exists external_delivery_url text,
  add column if not exists pricing_model text not null default 'paid',
  add column if not exists minimum_price_kobo integer not null default 0;

alter table public.assets
  drop constraint if exists assets_delivery_mode_check;

alter table public.assets
  add constraint assets_delivery_mode_check
  check (delivery_mode in ('file', 'external_link'));

alter table public.assets
  drop constraint if exists assets_pricing_model_check;

alter table public.assets
  add constraint assets_pricing_model_check
  check (pricing_model in ('free', 'paid', 'pay_what_you_want'));

alter table public.assets
  drop constraint if exists assets_minimum_price_kobo_check;

alter table public.assets
  add constraint assets_minimum_price_kobo_check
  check (minimum_price_kobo >= 0);

alter table public.assets
  drop constraint if exists assets_external_delivery_url_required_check;

alter table public.assets
  add constraint assets_external_delivery_url_required_check
  check (
    (delivery_mode = 'external_link' and nullif(btrim(external_delivery_url), '') is not null)
    or (delivery_mode = 'file' and external_delivery_url is null)
  );

alter table public.assets
  drop constraint if exists assets_pricing_configuration_check;

update public.assets
set
  pricing_model = case
    when price_kobo = 0 then 'free'
    else 'paid'
  end,
  minimum_price_kobo = case
    when price_kobo = 0 then 0
    else price_kobo
  end
where pricing_model is distinct from case
    when price_kobo = 0 then 'free'
    else 'paid'
  end
   or minimum_price_kobo is distinct from case
    when price_kobo = 0 then 0
    else price_kobo
  end;

alter table public.assets
  add constraint assets_pricing_configuration_check
  check (
    (pricing_model = 'free' and price_kobo = 0 and minimum_price_kobo = 0)
    or (pricing_model = 'paid' and price_kobo > 0 and minimum_price_kobo = price_kobo)
    or (pricing_model = 'pay_what_you_want' and price_kobo >= minimum_price_kobo)
  );

create index if not exists assets_delivery_mode_idx on public.assets (delivery_mode);
create index if not exists assets_pricing_model_idx on public.assets (pricing_model);
create index if not exists assets_minimum_price_idx on public.assets (minimum_price_kobo);

alter table public.orders
  add column if not exists delivery_mode text not null default 'file',
  add column if not exists delivery_external_url text;

alter table public.orders
  drop constraint if exists orders_delivery_mode_check;

alter table public.orders
  add constraint orders_delivery_mode_check
  check (delivery_mode in ('file', 'external_link'));

alter table public.orders
  drop constraint if exists orders_delivery_external_url_required_check;

alter table public.orders
  add constraint orders_delivery_external_url_required_check
  check (
    (delivery_mode = 'external_link' and nullif(btrim(delivery_external_url), '') is not null)
    or (delivery_mode = 'file' and delivery_external_url is null)
  );

update public.orders o
set
  delivery_mode = a.delivery_mode,
  delivery_external_url = case
    when a.delivery_mode = 'external_link' then a.external_delivery_url
    else null
  end
from public.assets a
where a.id = o.asset_id
  and (
    o.delivery_mode is distinct from a.delivery_mode
    or o.delivery_external_url is distinct from case
      when a.delivery_mode = 'external_link' then a.external_delivery_url
      else null
    end
  );

create index if not exists orders_delivery_mode_idx on public.orders (delivery_mode);

notify pgrst, 'reload schema';

