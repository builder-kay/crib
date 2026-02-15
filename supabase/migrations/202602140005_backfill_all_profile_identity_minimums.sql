update public.profiles p
set bio = concat(
  coalesce(nullif(btrim(p.display_name), ''), 'This creator'),
  ' is building and sharing digital work on Crib.'
)
where p.bio is null
   or btrim(p.bio) = '';

update public.profiles p
set creator_category = 'General'
where p.creator_category is null
   or btrim(p.creator_category) = '';
