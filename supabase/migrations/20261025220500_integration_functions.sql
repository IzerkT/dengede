create or replace function public.create_space(space_name text default 'Bizim alanımız')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_space uuid;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  if exists (select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'Kullanıcı zaten bir alana kayıtlı';
  end if;
  insert into public.shared_spaces (name, created_by)
  values (coalesce(nullif(trim(space_name), ''), 'Bizim alanımız'), auth.uid())
  returning id into new_space;
  insert into public.space_members (space_id, user_id) values (new_space, auth.uid());
  return new_space;
end;
$$;

create or replace function public.create_invitation(invite_space uuid, valid_for interval default interval '7 days')
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
  raw_token := encode(gen_random_bytes(24), 'base64url');
  expires := now() + least(greatest(valid_for, interval '1 hour'), interval '30 days');
  insert into public.invitations (space_id, token_hash, expires_at, created_by)
  values (invite_space, encode(digest(raw_token, 'sha256'), 'hex'), expires, auth.uid());
  return raw_token;
end;
$$;

revoke execute on function public.create_space(text) from public;
revoke execute on function public.create_invitation(uuid, interval) from public;
grant execute on function public.create_space(text) to authenticated;
grant execute on function public.create_invitation(uuid, interval) to authenticated;
