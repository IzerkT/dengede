-- Security hardening for direct membership inserts and water row moves.
-- Membership creation remains available through the SECURITY DEFINER RPCs.

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'space_members'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.space_members', policy_record.policyname);
  end loop;
end
$$;

drop policy if exists water_update_owner on public.water_entries;

create policy water_update_owner
on public.water_entries
for update
using (
  owner_id = auth.uid()
  and public.is_space_member(space_id)
)
with check (
  owner_id = auth.uid()
  and public.is_space_member(space_id)
);

do $$
declare
  insert_policy_count integer;
  water_policy record;
  create_space_definition text;
  join_space_definition text;
begin
  select count(*)
    into insert_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'space_members'
    and cmd = 'INSERT';

  if insert_policy_count <> 0 then
    raise exception 'space_members must not expose direct INSERT policies';
  end if;

  select *
    into water_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'water_entries'
    and policyname = 'water_update_owner';

  if water_policy.policyname is null
     or water_policy.qual not like '%owner_id = auth.uid()%'
     or water_policy.qual not like '%is_space_member%'
     or water_policy.with_check not like '%owner_id = auth.uid()%'
     or water_policy.with_check not like '%is_space_member%' then
    raise exception 'water_update_owner policy is not owner- and membership-constrained';
  end if;

  if to_regprocedure('public.create_space(text)') is null
     or to_regprocedure('public.join_space(text)') is null
     or to_regprocedure('public.create_invitation(uuid,interval)') is null
     or not has_function_privilege('authenticated', 'public.create_space(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.join_space(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_invitation(uuid,interval)', 'EXECUTE')
     or not exists (
       select 1
       from pg_proc
       where oid = to_regprocedure('public.create_space(text)')
         and prosecdef
         and coalesce(proconfig, '{}') @> array['search_path=public']
     )
     or not exists (
       select 1
       from pg_proc
       where oid = to_regprocedure('public.join_space(text)')
         and prosecdef
         and coalesce(proconfig, '{}') @> array['search_path=public']
     )
     or not exists (
       select 1
       from pg_proc
       where oid = to_regprocedure('public.create_invitation(uuid,interval)')
         and prosecdef
         and coalesce(proconfig, '{}') @> array['search_path=public']
     ) then
    raise exception 'membership RPC security properties are incomplete';
  end if;

  select pg_get_functiondef(to_regprocedure('public.create_space(text)'))
    into create_space_definition;
  select pg_get_functiondef(to_regprocedure('public.join_space(text)'))
    into join_space_definition;

  if create_space_definition not like '%auth.uid()%'
     or create_space_definition not like '%space_members%'
     or join_space_definition not like '%invite.used_at is not null%'
     or join_space_definition not like '%invite.expires_at <= now()%'
     or join_space_definition not like '%member_count >= 2%'
     or join_space_definition not like '%auth.uid()%' then
    raise exception 'membership RPC authorization checks are incomplete';
  end if;
end
$$;
