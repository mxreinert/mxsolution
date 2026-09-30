-- 010: mark a workout as "not in my usual gym" (different machines/plates, e.g. while travelling).
-- Such workouts are logged normally but not used as comparison for "Letztes Mal", PRs and the 1RM chart.
-- Only new columns on an existing table: the existing RLS policies of public.workouts apply unchanged.

alter table public.workouts
  add column if not exists other_gym boolean not null default false,
  add column if not exists gym_name  text check (length(gym_name) <= 80);
