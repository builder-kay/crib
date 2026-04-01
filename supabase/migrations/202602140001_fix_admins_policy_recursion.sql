-- Fix recursive RLS on public.admins
-- The prior policy referenced public.admins inside its own USING clause,
-- which can trigger infinite recursion during policy evaluation.

drop policy if exists "admins can manage admins" on public.admins;
drop policy if exists "users can view own admin record" on public.admins;

create policy "users can view own admin record"
on public.admins
for select
using (user_id = auth.uid());

notify pgrst, 'reload schema';
