with latest_creator_category as (
  select distinct on (a.creator_id)
    a.creator_id,
    a.category
  from public.assets a
  where a.category is not null
    and btrim(a.category) <> ''
  order by a.creator_id, a.created_at desc
)
update public.profiles p
set creator_category = coalesce(l.category, 'Creator')
from latest_creator_category l
where p.id = l.creator_id
  and (
    p.creator_category is null
    or btrim(p.creator_category) = ''
    or p.creator_category = 'General'
  );

update public.profiles p
set bio = concat(
  coalesce(nullif(btrim(p.display_name), ''), 'This creator'),
  ' creates and sells digital products on Crib.'
)
where exists (
    select 1
    from public.assets a
    where a.creator_id = p.id
  )
  and (
    p.bio is null
    or btrim(p.bio) = ''
  );
