-- 004_training: exercise database, training plans (versioned), workouts + sets,
-- tested 1RMs, cardio sessions (incl. KM Pacer results).

-- ---------------------------------------------------------------------------
-- Exercise database (fixed list, IDs from docs/Uebungsdatenbank.xlsx)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id             text primary key check (id ~ '^[A-Z0-9_]{3,40}$'),
  name           text not null,
  base           text,
  pattern        text,
  primary_muscle text not null,
  secondary      text[] not null default '{}',
  equipment      text,
  unilateral     boolean not null default false,
  tracking_type  text not null default 'weight_reps'
                 check (tracking_type in ('weight_reps', 'bodyweight_reps', 'bodyweight_plus', 'assisted', 'time', 'distance')),
  level          text,
  alt1           text references public.exercises (id) deferrable initially deferred,
  alt2           text references public.exercises (id) deferrable initially deferred,
  video_url      text check (video_url is null or video_url ~ '^https://'),
  hint           text,
  active         boolean not null default true,
  sort           int not null default 0
);

alter table public.exercises enable row level security;
revoke all on public.exercises from anon, authenticated;
grant select, insert, update on public.exercises to authenticated;
grant all on public.exercises to service_role;

create policy "everyone logged in reads exercises" on public.exercises
  for select to authenticated using (true);
create policy "coach adds exercises" on public.exercises
  for insert to authenticated with check ((select public.is_coach()));
create policy "coach edits exercises" on public.exercises
  for update to authenticated using ((select public.is_coach())) with check ((select public.is_coach()));

-- ---------------------------------------------------------------------------
-- Training plans. Templates have client_id = null. Assigned plans are copies.
-- Editing an assigned plan creates a new version (old one: is_active = false).
-- sessions jsonb:
--   [{ "key": "A", "name": "Push", "exercises": [
--       { "exercise_id": "BRU_BD_LH", "sets": 3, "rep_min": 6, "rep_max": 10,
--         "rir": 2, "rest_s": 150, "note": "", "group": null, "warmup_sets": 1 } ] }]
-- ---------------------------------------------------------------------------
create table public.training_plans (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client_id    uuid references public.clients (id) on delete cascade,
  name         text not null check (length(name) between 1 and 120),
  template_id  uuid references public.training_plans (id) on delete set null,
  version      int not null default 1,
  supersedes   uuid references public.training_plans (id) on delete set null,
  is_active    boolean not null default true,
  weeks        smallint check (weeks between 1 and 52),
  deload_week  smallint check (deload_week between 1 and 52),
  per_week     smallint check (per_week between 1 and 14),  -- planned sessions per week
  start_date   date,
  sessions     jsonb not null default '[]',
  notes        text check (length(notes) <= 4000),
  created_at   timestamptz not null default now()
);
create index training_plans_client_idx on public.training_plans (client_id, is_active);
create unique index training_plans_one_active on public.training_plans (client_id) where is_active and client_id is not null;

alter table public.training_plans enable row level security;
revoke all on public.training_plans from anon, authenticated;
grant select, insert, update, delete on public.training_plans to authenticated;
grant all on public.training_plans to service_role;

create policy "client reads own plans" on public.training_plans
  for select to authenticated
  using (client_id is not null and client_id = (select public.my_client_id()));

create policy "coach manages plans" on public.training_plans
  for all to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach())
         and (client_id is null or (select public.is_my_client(client_id))))
  with check (coach_id = (select auth.uid()) and (select public.is_coach())
         and (client_id is null or (select public.is_my_client(client_id))));

create function public.plan_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is not null and new.is_active then
    perform public.notify_client(new.client_id, 'plan', 'Neuer Trainingsplan', new.name, '#/training');
  end if;
  return new;
end;
$$;

create trigger training_plans_notify after insert on public.training_plans
  for each row execute function public.plan_notify();

-- ---------------------------------------------------------------------------
-- Workouts and sets. IDs are generated on the device (offline logging).
-- ---------------------------------------------------------------------------
create table public.workouts (
  id            uuid primary key,
  client_id     uuid not null references public.clients (id) on delete cascade,
  plan_id       uuid references public.training_plans (id) on delete set null,
  session_key   text,
  session_name  text check (length(session_name) <= 120),
  day           date not null,
  started_at    timestamptz,
  finished_at   timestamptz,
  kind          text not null default 'plan' check (kind in ('plan', 'free')),
  effort        smallint check (effort between 1 and 10),
  pain          boolean not null default false,
  pain_location text check (length(pain_location) <= 200),
  note          text check (length(note) <= 2000),
  with_coach    boolean not null default false,
  appointment_id uuid,
  source        text not null default 'app' check (source in ('app', 'hevy')),
  external_id   text,
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  unique (client_id, source, external_id)
);
create index workouts_client_day_idx on public.workouts (client_id, day);

create trigger workouts_touch before update on public.workouts
  for each row execute function public.touch_updated_at();

create table public.workout_sets (
  id            uuid primary key,
  workout_id    uuid not null references public.workouts (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  exercise_id   text not null references public.exercises (id),
  pos           smallint not null,          -- exercise order within workout
  set_no        smallint not null,
  set_type      text not null default 'normal' check (set_type in ('warmup', 'normal', 'drop', 'superset', 'assisted')),
  side          text check (side in ('left', 'right')),
  weight_kg     numeric(6,2) check (weight_kg between -300 and 1000), -- negative = assistance
  reps          smallint check (reps between 0 and 1000),
  seconds       int check (seconds between 0 and 36000),
  distance_m    numeric(8,1) check (distance_m between 0 and 100000),
  rir           numeric(3,1) check (rir between 0 and 10),
  created_at    timestamptz not null default now()
);
create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_client_ex_idx on public.workout_sets (client_id, exercise_id);

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
revoke all on public.workouts, public.workout_sets from anon, authenticated;
grant select, insert, update, delete on public.workouts, public.workout_sets to authenticated;
grant all on public.workouts, public.workout_sets to service_role;

create policy "read workouts" on public.workouts
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "client logs workouts" on public.workouts
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day) and source = 'app'
    and (kind = 'plan' or 'free_training' = any((select c.unlocks from public.clients c where c.id = client_id))));
create policy "client edits recent workouts" on public.workouts
  for update to authenticated
  using (client_id = (select public.my_client_id()) and public.client_day_ok(day) and source = 'app')
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day) and source = 'app');
create policy "client deletes recent workouts" on public.workouts
  for delete to authenticated
  using (client_id = (select public.my_client_id()) and public.client_day_ok(day) and source = 'app');
create policy "coach manages workouts" on public.workouts
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

create policy "read sets" on public.workout_sets
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "client writes sets of recent workouts" on public.workout_sets
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.client_id = workout_sets.client_id
      and public.client_day_ok(w.day) and w.source = 'app'));
create policy "client updates sets of recent workouts" on public.workout_sets
  for update to authenticated
  using (client_id = (select public.my_client_id()) and exists (
    select 1 from public.workouts w
    where w.id = workout_id and public.client_day_ok(w.day) and w.source = 'app'))
  with check (client_id = (select public.my_client_id()));
create policy "client deletes sets of recent workouts" on public.workout_sets
  for delete to authenticated
  using (client_id = (select public.my_client_id()) and exists (
    select 1 from public.workouts w
    where w.id = workout_id and public.client_day_ok(w.day) and w.source = 'app'));
create policy "coach manages sets" on public.workout_sets
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

-- pain reported -> coach is notified immediately
create function public.workout_pain_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pain and (tg_op = 'INSERT' or not old.pain) then
    perform public.notify_coach(new.client_id, 'pain', 'Schmerzen im Training gemeldet',
      coalesce(new.pain_location, 'ohne Angabe'), '#/c/kunde/' || new.client_id);
  end if;
  return new;
end;
$$;

create trigger workouts_pain after insert or update of pain on public.workouts
  for each row execute function public.workout_pain_notify();

-- ---------------------------------------------------------------------------
-- Tested 1RM (has priority over the estimate)
-- ---------------------------------------------------------------------------
create table public.tested_maxes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  day         date not null,
  weight_kg   numeric(6,2) not null check (weight_kg between 0 and 1000),
  created_at  timestamptz not null default now()
);
create index tested_maxes_idx on public.tested_maxes (client_id, exercise_id, day);

alter table public.tested_maxes enable row level security;
revoke all on public.tested_maxes from anon, authenticated;
grant select, insert, delete on public.tested_maxes to authenticated;
grant all on public.tested_maxes to service_role;

create policy "read maxes" on public.tested_maxes
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "client adds max" on public.tested_maxes
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day));
create policy "delete maxes" on public.tested_maxes
  for delete to authenticated
  using ((client_id = (select public.my_client_id()) and public.client_day_ok(day))
         or (select public.is_my_client(client_id)));
create policy "coach adds max" on public.tested_maxes
  for insert to authenticated
  with check ((select public.is_my_client(client_id)));

-- ---------------------------------------------------------------------------
-- M2 Cardio
-- ---------------------------------------------------------------------------
create table public.cardio_sessions (
  id           uuid primary key,
  client_id    uuid not null references public.clients (id) on delete cascade,
  day          date not null,
  kind         text not null check (kind in ('run', 'bike', 'swim', 'row', 'walk', 'other')),
  duration_min numeric(6,1) check (duration_min between 0 and 2000),
  distance_km  numeric(7,2) check (distance_km between 0 and 1000),
  intensity    text check (intensity in ('easy', 'tempo', 'interval', 'long')),
  effort       smallint check (effort between 1 and 10),
  avg_hr       smallint check (avg_hr between 30 and 250),
  splits       jsonb,             -- KM Pacer: [{"km": "1", "distance_km": 1, "sec": 300}]
  source       text not null default 'manual' check (source in ('manual', 'pacer')),
  note         text check (length(note) <= 1000),
  created_at   timestamptz not null default now()
);
create index cardio_client_day_idx on public.cardio_sessions (client_id, day);

alter table public.cardio_sessions enable row level security;
revoke all on public.cardio_sessions from anon, authenticated;
grant select, insert, update, delete on public.cardio_sessions to authenticated;
grant all on public.cardio_sessions to service_role;

create policy "read cardio" on public.cardio_sessions
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "client logs cardio" on public.cardio_sessions
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day));
create policy "client edits cardio" on public.cardio_sessions
  for update to authenticated
  using (client_id = (select public.my_client_id()) and public.client_day_ok(day))
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day));
create policy "client deletes cardio" on public.cardio_sessions
  for delete to authenticated
  using (client_id = (select public.my_client_id()) and public.client_day_ok(day));
create policy "coach manages cardio" on public.cardio_sessions
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));
