-- Corrective migration for remote databases that already applied the original
-- migrations. It never moves an existing extension automatically.
create schema if not exists extensions;

do $$
declare
  installed_schema text;
begin
  select n.nspname
    into installed_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if installed_schema is null then
    execute 'create extension pgcrypto with schema extensions';
  elsif installed_schema <> 'extensions' then
    raise exception
      'pgcrypto is installed in schema "%". Move it explicitly with ALTER EXTENSION pgcrypto SET SCHEMA extensions, then rerun this migration.',
      installed_schema;
  end if;
end
$$;

create or replace function public.join_space(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare invite public.invitations%rowtype; member_count integer; joining_space uuid;
begin
  select * into invite
  from public.invitations
  where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
  for update;
  if invite.id is null or invite.used_at is not null or invite.expires_at <= now() then
    raise exception 'Davet geçersiz veya süresi dolmuş';
  end if;
  select count(*) into member_count
  from public.space_members
  where space_id = invite.space_id;
  if member_count >= 2 then raise exception 'Bu alan zaten dolu'; end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'Kullanıcı zaten bir alana kayıtlı';
  end if;
  insert into public.space_members(space_id, user_id)
  values (invite.space_id, auth.uid());
  update public.invitations set used_at = now() where id = invite.id;
  joining_space := invite.space_id;
  return joining_space;
end;
$$;

create or replace function public.create_invitation(
  invite_space uuid,
  valid_for interval default interval '7 days'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare raw_token text; expires timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.space_members
    where space_id = invite_space and user_id = auth.uid()
  ) then raise exception 'Bu alana erişim yok'; end if;
  if (select count(*) from public.space_members where space_id = invite_space) >= 2 then
    raise exception 'Bu alan zaten dolu';
  end if;
  raw_token := encode(extensions.gen_random_bytes(24), 'base64url');
  expires := now() + least(greatest(valid_for, interval '1 hour'), interval '30 days');
  insert into public.invitations (space_id, token_hash, expires_at, created_by)
  values (
    invite_space,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    expires,
    auth.uid()
  );
  return raw_token;
end;
$$;

revoke execute on function public.join_space(text) from public;
grant execute on function public.join_space(text) to authenticated;
revoke execute on function public.create_invitation(uuid, interval) from public;
grant execute on function public.create_invitation(uuid, interval) to authenticated;

do $$
begin
  if to_regprocedure('public.create_invitation(uuid,interval)') is null
     or to_regprocedure('public.join_space(text)') is null
     or to_regprocedure('extensions.gen_random_bytes(integer)') is null
     or to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'pgcrypto corrective migration verification failed';
  end if;
end
$$;
