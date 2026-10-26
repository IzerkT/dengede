-- Additive progress model. Existing user_goals rows are preserved and become
-- the first effective-dated revision for each user.
alter table public.user_goals
  add column if not exists calories_enabled boolean not null default true,
  add column if not exists calorie_min integer,
  add column if not exists calorie_max integer,
  add column if not exists protein_enabled boolean not null default true,
  add column if not exists protein_min numeric(8,2),
  add column if not exists water_enabled boolean not null default true,
  add column if not exists water_min_ml integer,
  add column if not exists required_metrics smallint;

create table if not exists public.user_goal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  valid_from date not null,
  calorie_goal integer,
  protein_goal numeric(8,2),
  water_goal_ml integer,
  calories_enabled boolean not null default true,
  calorie_min integer,
  calorie_max integer,
  protein_enabled boolean not null default true,
  protein_min numeric(8,2),
  water_enabled boolean not null default true,
  water_min_ml integer,
  required_metrics smallint,
  created_at timestamptz not null default now(),
  unique (user_id, valid_from),
  check (required_metrics is null or required_metrics between 1 and 3),
  check (calorie_min is null or calorie_min > 0),
  check (calorie_max is null or calorie_max > 0),
  check (protein_min is null or protein_min > 0),
  check (water_min_ml is null or water_min_ml > 0)
);

insert into public.user_goal_history (
  user_id, valid_from, calorie_goal, protein_goal, water_goal_ml,
  calories_enabled, calorie_min, calorie_max, protein_enabled, protein_min,
  water_enabled, water_min_ml, required_metrics
)
select user_id, current_date, calorie_goal, protein_goal, water_goal_ml,
  calories_enabled, calorie_min, calorie_max, protein_enabled, protein_min,
  water_enabled, water_min_ml, required_metrics
from public.user_goals
on conflict (user_id, valid_from) do nothing;

create index if not exists user_goal_history_lookup_idx
  on public.user_goal_history(user_id, valid_from desc);

create table if not exists public.achievement_definitions (
  id text primary key,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

insert into public.achievement_definitions (id, title, message) values
  ('first-success', 'İlk başarılı gün', 'İlk başarılı gününü tamamladın.'),
  ('three-successes', 'Üç başarılı gün', 'Üç başarılı gün birikti.'),
  ('first-week', 'İlk başarılı hafta', 'Bir haftayı başarıyla tamamladın.'),
  ('five-water', 'Beş su hedefi başarısı', 'Beş su hedefini tamamladın.'),
  ('ten-successes', 'On başarılı gün', 'On başarılı gün hedefini tamamladın.'),
  ('joint-ten-successes', 'Birlikte on başarılı gün', 'Partnerinle birlikte on başarılı gün tamamladınız.')
on conflict (id) do nothing;

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievement_definitions(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_goal_history enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.user_achievements enable row level security;

create policy goal_history_read_same_space on public.user_goal_history
  for select using (
    user_id = auth.uid() or exists (
      select 1 from public.space_members mine
      join public.space_members theirs on theirs.space_id = mine.space_id
      where mine.user_id = auth.uid() and theirs.user_id = public.user_goal_history.user_id
    )
  );
create policy goal_history_insert_self on public.user_goal_history
  for insert with check (user_id = auth.uid());
create policy achievement_definitions_read_authenticated on public.achievement_definitions
  for select using (auth.uid() is not null);
create policy user_achievements_read_same_space on public.user_achievements
  for select using (
    user_id = auth.uid() or exists (
      select 1 from public.space_members mine
      join public.space_members theirs on theirs.space_id = mine.space_id
      where mine.user_id = auth.uid() and theirs.user_id = public.user_achievements.user_id
    )
  );
create policy user_achievements_insert_self on public.user_achievements
  for insert with check (user_id = auth.uid());

create index if not exists food_entries_owner_recorded_idx on public.food_entries(owner_id, recorded_at);
create index if not exists water_entries_owner_recorded_idx on public.water_entries(owner_id, recorded_at);
