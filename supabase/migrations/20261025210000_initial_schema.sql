create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.shared_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Bizim alanımız',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.space_members (
  space_id uuid not null references public.shared_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id),
  unique (user_id)
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.shared_spaces(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alternative_names text[] not null default '{}',
  calories_per_100 numeric(8,2) not null check (calories_per_100 >= 0),
  protein_per_100 numeric(8,2) not null check (protein_per_100 >= 0),
  default_unit text not null,
  grams_per_unit numeric(10,2) not null check (grams_per_unit > 0),
  source text not null,
  is_approximate boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.shared_spaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.food_entry_items (
  id uuid primary key default gen_random_uuid(),
  food_entry_id uuid not null references public.food_entries(id) on delete cascade,
  food_id uuid references public.foods(id),
  food_name_snapshot text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  unit text not null,
  grams numeric(10,2) not null check (grams > 0),
  calories_snapshot numeric(10,2) not null check (calories_snapshot >= 0),
  protein_snapshot numeric(10,2) not null check (protein_snapshot >= 0)
);
create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.shared_spaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer not null check (amount_ml > 0 and amount_ml <= 10000),
  recorded_at timestamptz not null default now()
);
create table public.user_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calorie_goal integer check (calorie_goal is null or calorie_goal > 0),
  protein_goal numeric(8,2) check (protein_goal is null or protein_goal > 0),
  water_goal_ml integer check (water_goal_ml is null or water_goal_ml > 0),
  updated_at timestamptz not null default now()
);
create index food_entries_space_recorded_idx on public.food_entries(space_id, recorded_at);
create index water_entries_space_recorded_idx on public.water_entries(space_id, recorded_at);
create index food_entry_items_entry_idx on public.food_entry_items(food_entry_id);

create or replace function public.is_space_member(target_space uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.space_members where space_id = target_space and user_id = auth.uid()); $$;
create or replace function public.is_entry_owner(target_owner uuid)
returns boolean language sql stable as $$ select target_owner = auth.uid(); $$;
create or replace function public.join_space(invite_token text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare invite invitations%rowtype; member_count integer; joining_space uuid;
begin
  select * into invite from invitations where token_hash = encode(digest(invite_token, 'sha256'), 'hex') for update;
  if invite.id is null or invite.used_at is not null or invite.expires_at <= now() then raise exception 'Davet geçersiz veya süresi dolmuş'; end if;
  select count(*) into member_count from space_members where space_id = invite.space_id;
  if member_count >= 2 then raise exception 'Bu alan zaten dolu'; end if;
  if exists (select 1 from space_members where user_id = auth.uid()) then raise exception 'Kullanıcı zaten bir alana kayıtlı'; end if;
  insert into space_members(space_id, user_id) values (invite.space_id, auth.uid());
  update invitations set used_at = now() where id = invite.id;
  joining_space := invite.space_id;
  return joining_space;
end; $$;
revoke execute on function public.join_space(text) from public;
grant execute on function public.join_space(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.shared_spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.invitations enable row level security;
alter table public.foods enable row level security;
alter table public.food_entries enable row level security;
alter table public.food_entry_items enable row level security;
alter table public.water_entries enable row level security;
alter table public.user_goals enable row level security;

create policy profiles_read_same_space on public.profiles for select using (id = auth.uid() or exists (select 1 from space_members mine join space_members theirs on mine.space_id = theirs.space_id where mine.user_id = auth.uid() and theirs.user_id = profiles.id));
create policy profiles_insert_self on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy spaces_read_member on public.shared_spaces for select using (public.is_space_member(id));
create policy spaces_create_self on public.shared_spaces for insert with check (created_by = auth.uid());
create policy members_read_member on public.space_members for select using (public.is_space_member(space_id));
create policy members_insert_self on public.space_members for insert with check (user_id = auth.uid());
create policy invitations_create_member on public.invitations for insert with check (created_by = auth.uid() and public.is_space_member(space_id));
create policy invitations_read_creator on public.invitations for select using (created_by = auth.uid());
create policy foods_read_authenticated on public.foods for select using (auth.uid() is not null);
create policy foods_create_self on public.foods for insert with check (created_by = auth.uid());
create policy entries_read_member on public.food_entries for select using (public.is_space_member(space_id));
create policy entries_create_owner on public.food_entries for insert with check (owner_id = auth.uid() and public.is_space_member(space_id));
create policy entries_update_owner on public.food_entries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_space_member(space_id));
create policy entries_delete_owner on public.food_entries for delete using (owner_id = auth.uid());
create policy items_read_member on public.food_entry_items for select using (exists (select 1 from food_entries where id = food_entry_id and public.is_space_member(space_id)));
create policy items_create_owner on public.food_entry_items for insert with check (exists (select 1 from food_entries where id = food_entry_id and owner_id = auth.uid()));
create policy items_update_owner on public.food_entry_items for update using (exists (select 1 from food_entries where id = food_entry_id and owner_id = auth.uid()));
create policy items_delete_owner on public.food_entry_items for delete using (exists (select 1 from food_entries where id = food_entry_id and owner_id = auth.uid()));
create policy water_read_member on public.water_entries for select using (public.is_space_member(space_id));
create policy water_create_owner on public.water_entries for insert with check (owner_id = auth.uid() and public.is_space_member(space_id));
create policy water_update_owner on public.water_entries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy water_delete_owner on public.water_entries for delete using (owner_id = auth.uid());
create policy goals_read_self on public.user_goals for select using (user_id = auth.uid());
create policy goals_upsert_self on public.user_goals for insert with check (user_id = auth.uid());
create policy goals_update_self on public.user_goals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
