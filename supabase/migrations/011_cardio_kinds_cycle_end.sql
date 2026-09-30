-- 011: more cardio types, end date for periods, entries up to 5 days back.
-- No new table. RLS changes:
--   * cycle_entries gets an UPDATE policy: a client may only change her own rows (to set the end date);
--     the coach may not change them (read/delete as before).
--   * client_day_ok: clients may enter/edit data up to 5 days back (before: 3). Applies to every table
--     that already uses this function (evening check, workouts, cardio …). Coach rules unchanged.

-- ---------- cardio types ----------
alter table public.cardio_sessions drop constraint if exists cardio_sessions_kind_check;
alter table public.cardio_sessions add constraint cardio_sessions_kind_check check (kind in (
  'run', 'treadmill', 'bike', 'bike_indoor', 'row', 'walk', 'hike', 'swim',
  'jump_rope', 'hiit', 'stairs', 'elliptical', 'incline_walk', 'circuit', 'crossfit', 'class',
  'boxing', 'football', 'basketball', 'tennis', 'badminton', 'volleyball', 'dance',
  'inline', 'ski', 'xc_ski', 'paddle', 'climbing', 'mobility', 'other'
));

-- ---------- period end ----------
alter table public.cycle_entries
  add column if not exists end_date date;
alter table public.cycle_entries drop constraint if exists cycle_entries_end_check;
alter table public.cycle_entries add constraint cycle_entries_end_check
  check (end_date is null or (end_date >= start_date and end_date <= start_date + 14));

grant update (end_date) on public.cycle_entries to authenticated;

drop policy if exists "client ends cycle" on public.cycle_entries;
create policy "client ends cycle" on public.cycle_entries
  for update to authenticated
  using (client_id = (select public.my_client_id()))
  with check (client_id = (select public.my_client_id()) and (end_date is null or end_date <= public.today_lu() + 1));

-- ---------- 5 days back ----------
create or replace function public.client_day_ok(d date)
returns boolean
language sql
stable
set search_path = ''
as $$ select d between public.today_lu() - 5 and public.today_lu() + 1 $$;
