-- 003_tracking: daily entries (Abend-Check), weekly check-ins, cycle, measurements,
-- progress photos, supplements, and the private file bucket.

-- ---------------------------------------------------------------------------
-- Daily entries: one row per client and day. Empty = not entered.
-- not_tracked lists fields the client marked as "bewusst nicht getrackt".
-- ---------------------------------------------------------------------------
create table public.daily_entries (
  client_id     uuid not null references public.clients (id) on delete cascade,
  day           date not null,
  weight_kg     numeric(5,2) check (weight_kg between 20 and 400),
  kcal          int check (kcal between 0 and 20000),
  protein_g     int check (protein_g between 0 and 1000),
  carbs_g       int check (carbs_g between 0 and 2000),
  fat_g         int check (fat_g between 0 and 1000),
  steps         int check (steps between 0 and 200000),
  active_kcal   int check (active_kcal between 0 and 10000),
  sleep_h       numeric(3,1) check (sleep_h between 0 and 24),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  motivation    smallint check (motivation between 1 and 5),
  energy        smallint check (energy between 1 and 5),
  resting_hr    smallint check (resting_hr between 20 and 250),
  hrv_ms        smallint check (hrv_ms between 1 and 500),
  note          text check (length(note) <= 1000),
  not_tracked   text[] not null default '{}',
  updated_at    timestamptz not null default now(),
  updated_by    uuid default auth.uid(),
  primary key (client_id, day)
);

create trigger daily_entries_touch before update on public.daily_entries
  for each row execute function public.touch_updated_at();

alter table public.daily_entries enable row level security;
revoke all on public.daily_entries from anon, authenticated;
grant select, insert, update, delete on public.daily_entries to authenticated;
grant all on public.daily_entries to service_role;

create policy "read daily entries" on public.daily_entries
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

create policy "client inserts recent days" on public.daily_entries
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day));

create policy "client updates recent days" on public.daily_entries
  for update to authenticated
  using (client_id = (select public.my_client_id()) and public.client_day_ok(day))
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day));

create policy "coach manages daily entries" on public.daily_entries
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

-- ---------------------------------------------------------------------------
-- Weekly check-in
-- ---------------------------------------------------------------------------
create table public.checkins (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  week_start    date not null,                 -- Monday of the week
  rating        smallint check (rating between 1 and 5),
  rating_text   text check (length(rating_text) <= 2000),
  hunger        smallint check (hunger between 1 and 5),
  stress        smallint check (stress between 1 and 5),
  recovery      smallint check (recovery between 1 and 5),
  difficult     text check (length(difficult) <= 2000),
  summary       jsonb not null default '{}',   -- automatic weekly summary at submit time
  submitted_at  timestamptz not null default now(),
  feedback      text check (length(feedback) <= 5000),
  feedback_at   timestamptz,
  feedback_seen_at timestamptz,
  unique (client_id, week_start)
);

alter table public.checkins enable row level security;
revoke all on public.checkins from anon, authenticated;
grant select, insert, update on public.checkins to authenticated;
grant all on public.checkins to service_role;

create policy "read checkins" on public.checkins
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

create policy "client submits checkin" on public.checkins
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and feedback is null);

-- client may edit until feedback exists (and mark feedback as seen)
create policy "client edits checkin" on public.checkins
  for update to authenticated
  using (client_id = (select public.my_client_id()))
  with check (client_id = (select public.my_client_id()));

create policy "coach gives feedback" on public.checkins
  for update to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

-- clients cannot write feedback, and cannot change answers after feedback
create function public.guard_checkin_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.my_client_id() = old.client_id then
    if new.feedback is distinct from old.feedback or new.feedback_at is distinct from old.feedback_at then
      raise exception 'feedback is written by the coach';
    end if;
    if old.feedback is not null and (
       new.rating, new.rating_text, new.hunger, new.stress, new.recovery, new.difficult, new.summary)
       is distinct from
      (old.rating, old.rating_text, old.hunger, old.stress, old.recovery, old.difficult, old.summary) then
      raise exception 'check-in is closed';
    end if;
  end if;
  return new;
end;
$$;

create trigger checkins_guard before update on public.checkins
  for each row execute function public.guard_checkin_update();

create function public.checkin_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_coach(new.client_id, 'checkin', 'Neuer Check-in', null, '#/c/checkins');
  return new;
end;
$$;

create trigger checkins_notify_ins after insert on public.checkins
  for each row execute function public.checkin_notify();

create function public.checkin_feedback_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.feedback is not null and new.feedback is distinct from old.feedback then
    new.feedback_at := now();
    new.feedback_seen_at := null;
    perform public.notify_client(new.client_id, 'feedback', 'Neues Feedback von Max', left(new.feedback, 140), '#/heute');
  end if;
  return new;
end;
$$;

create trigger checkins_feedback before update on public.checkins
  for each row execute function public.checkin_feedback_time();

-- ---------------------------------------------------------------------------
-- M14 Zyklus: only the start date of the period. Client can delete everything.
-- ---------------------------------------------------------------------------
create table public.cycle_entries (
  client_id  uuid not null references public.clients (id) on delete cascade,
  start_date date not null,
  created_at timestamptz not null default now(),
  primary key (client_id, start_date)
);

alter table public.cycle_entries enable row level security;
revoke all on public.cycle_entries from anon, authenticated;
grant select, insert, delete on public.cycle_entries to authenticated;
grant all on public.cycle_entries to service_role;

create policy "read cycle" on public.cycle_entries
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

create policy "client adds cycle" on public.cycle_entries
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and start_date <= public.today_lu() + 1);

create policy "client deletes cycle" on public.cycle_entries
  for delete to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

-- ---------------------------------------------------------------------------
-- M11 Umfänge + Fotos
-- ---------------------------------------------------------------------------
create table public.measurements (
  client_id  uuid not null references public.clients (id) on delete cascade,
  day        date not null,
  waist_cm   numeric(5,1) check (waist_cm between 20 and 300),
  chest_cm   numeric(5,1) check (chest_cm between 20 and 300),
  hip_cm     numeric(5,1) check (hip_cm between 20 and 300),
  arm_cm     numeric(5,1) check (arm_cm between 5 and 100),
  thigh_cm   numeric(5,1) check (thigh_cm between 10 and 150),
  note       text check (length(note) <= 500),
  primary key (client_id, day)
);

create table public.progress_photos (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  day        date not null,
  pose       text not null check (pose in ('front', 'side', 'back')),
  path       text not null,           -- storage path: <client_id>/photos/<id>.jpg
  created_at timestamptz not null default now()
);
create index progress_photos_client_idx on public.progress_photos (client_id, day);

alter table public.measurements enable row level security;
alter table public.progress_photos enable row level security;
revoke all on public.measurements, public.progress_photos from anon, authenticated;
grant select, insert, update, delete on public.measurements, public.progress_photos to authenticated;
grant all on public.measurements, public.progress_photos to service_role;

create policy "read measurements" on public.measurements
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "client writes measurements" on public.measurements
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day));
create policy "client updates measurements" on public.measurements
  for update to authenticated
  using (client_id = (select public.my_client_id()) and public.client_day_ok(day))
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day));
create policy "coach manages measurements" on public.measurements
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

create policy "read photos" on public.progress_photos
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "client adds photos" on public.progress_photos
  for insert to authenticated
  with check (client_id = (select public.my_client_id()));
create policy "delete photos" on public.progress_photos
  for delete to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

-- ---------------------------------------------------------------------------
-- M17 Supplemente (incl. creatine as special supplement)
-- ---------------------------------------------------------------------------
create table public.supplements (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null check (length(name) between 1 and 80),
  dose        numeric(8,2),
  unit        text check (unit in ('g', 'mg', 'µg', 'IE', 'ml', 'Kapseln', 'Tabletten', 'Portion')),
  timing      text check (timing in ('morning', 'noon', 'evening', 'pre', 'post', 'any')),
  is_creatine boolean not null default false,
  started_on  date not null default public.today_lu(),
  ended_on    date,
  note        text check (length(note) <= 500),
  added_by_client boolean not null default false,
  created_at  timestamptz not null default now()
);
create index supplements_client_idx on public.supplements (client_id);

create table public.supplement_logs (
  client_id     uuid not null references public.clients (id) on delete cascade,
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  day           date not null,
  taken         boolean not null,
  amount        numeric(8,2),
  primary key (supplement_id, day)
);
create index supplement_logs_client_idx on public.supplement_logs (client_id, day);

alter table public.supplements enable row level security;
alter table public.supplement_logs enable row level security;
revoke all on public.supplements, public.supplement_logs from anon, authenticated;
grant select, insert, update, delete on public.supplements, public.supplement_logs to authenticated;
grant all on public.supplements, public.supplement_logs to service_role;

create policy "read supplements" on public.supplements
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "client adds own supplement" on public.supplements
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and added_by_client);
create policy "client ends own supplement" on public.supplements
  for update to authenticated
  using (client_id = (select public.my_client_id()) and added_by_client)
  with check (client_id = (select public.my_client_id()) and added_by_client);
create policy "coach manages supplements" on public.supplements
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

create policy "read supplement logs" on public.supplement_logs
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "client logs supplements" on public.supplement_logs
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day)
    and exists (select 1 from public.supplements s where s.id = supplement_id and s.client_id = supplement_logs.client_id));
create policy "client updates supplement logs" on public.supplement_logs
  for update to authenticated
  using (client_id = (select public.my_client_id()) and public.client_day_ok(day))
  with check (client_id = (select public.my_client_id()) and public.client_day_ok(day));
create policy "coach manages supplement logs" on public.supplement_logs
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

-- ---------------------------------------------------------------------------
-- Private file bucket: <client_id>/avatar.jpg, <client_id>/photos/<id>.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-files', 'client-files', false, 400000, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "client files read" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-files' and (
    (storage.foldername(name))[1] = (select public.my_client_id())::text
    or (select public.is_my_client(((storage.foldername(name))[1])::uuid))));

create policy "client files insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-files' and (
    (storage.foldername(name))[1] = (select public.my_client_id())::text
    or (select public.is_my_client(((storage.foldername(name))[1])::uuid))));

create policy "client files update" on storage.objects
  for update to authenticated
  using (bucket_id = 'client-files' and (
    (storage.foldername(name))[1] = (select public.my_client_id())::text
    or (select public.is_my_client(((storage.foldername(name))[1])::uuid))));

create policy "client files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-files' and (
    (storage.foldername(name))[1] = (select public.my_client_id())::text
    or (select public.is_my_client(((storage.foldername(name))[1])::uuid))));
