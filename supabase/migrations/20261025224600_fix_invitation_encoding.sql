-- PostgreSQL encode() supports base64, not base64url. Keep the random
-- bytes and convert the standard base64 alphabet to URL-safe characters.
create or replace function public.create_invitation(
  invite_space uuid,
  valid_for interval default interval '7 days'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_token text;
  expires timestamptz;
begin
  if auth.uid() is null
     or not exists (
       select 1
       from public.space_members
       where space_id = invite_space
         and user_id = auth.uid()
     ) then
    raise exception 'Bu alana erişim yok';
  end if;

  if (
    select count(*)
    from public.space_members
    where space_id = invite_space
  ) >= 2 then
    raise exception 'Bu alan zaten dolu';
  end if;

  raw_token := translate(
    rtrim(
      encode(extensions.gen_random_bytes(24), 'base64'),
      '='
    ),
    '+/',
    '-_'
  );

  expires := now()
    + least(
        greatest(valid_for, interval '1 hour'),
        interval '30 days'
      );

  insert into public.invitations (
    space_id,
    token_hash,
    expires_at,
    created_by
  )
  values (
    invite_space,
    encode(
      extensions.digest(raw_token, 'sha256'),
      'hex'
    ),
    expires,
    auth.uid()
  );

  return raw_token;
end;
$$;

revoke execute on function public.create_invitation(uuid, interval) from public;
grant execute on function public.create_invitation(uuid, interval) to authenticated;

do $$
begin
  if to_regprocedure('public.create_invitation(uuid,interval)') is null then
    raise exception 'create_invitation corrective migration verification failed';
  end if;
end
$$;
