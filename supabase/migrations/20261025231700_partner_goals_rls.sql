-- Allow members of the same private space to read each other's goals.
-- Inserts and updates remain owner-only.
drop policy if exists goals_read_self on public.user_goals;

create policy goals_read_same_space
on public.user_goals
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.space_members mine
    join public.space_members theirs
      on mine.space_id = theirs.space_id
    where mine.user_id = auth.uid()
      and theirs.user_id = public.user_goals.user_id
  )
);
