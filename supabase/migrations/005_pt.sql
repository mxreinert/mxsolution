-- 005_pt: M12 Personal Training – locations, appointments (1..n clients),
-- PT balance ledger. Payment happens offline; the app only counts.

create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name       text not null check (length(name) between 1 and 120),
  address    text check (length(address) <= 300),
  hint       text check (length(hint) <= 500),
  active     boolean not null default true
);

create table public.appointments (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  starts_at     timestamptz not null,
  duration_min  smallint not null default 60 check (duration_min between 5 and 600),
  location_id   uuid references public.locations (id) on delete set null,
  kind          text not null default 'strength' check (kind in ('strength', 'cardio', 'technique', 'test', 'other')),
  note          text check (length(note) <= 1000),       -- visible to client ("Laufschuhe mitbringen")
  status        text not null default 'planned' check (status in ('planned', 'done', 'cancelled', 'moved')),
  series_id     uuid,                                      -- recurring appointments share this id
  coach_note    text check (length(coach_note) <= 2000),  -- after the session
  coach_note_visible boolean not null default false,
  gcal_event_id text,
  created_at    timestamptz not null default now()
);
create index appointments_coach_time_idx on public.appointments (coach_id, starts_at);

create table public.appointment_clients (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  client_id      uuid not null references public.clients (id) on delete cascade,
  status         text not null default 'open'
                 check (status in ('open', 'confirmed', 'cancelled_client', 'cancelled_coach', 'cancelled_sick', 'no_show', 'attended')),
  late_cancel    boolean not null default false,
  responded_at   timestamptz,
  primary key (appointment_id, client_id)
);
create index appointment_clients_client_idx on public.appointment_clients (client_id);

create table public.pt_ledger (
  id             bigint generated always as identity primary key,
  client_id      uuid not null references public.clients (id) on delete cascade,
  delta          int not null check (delta between -100 and 100 and delta <> 0),
  reason         text not null check (reason in ('payment', 'block', 'session', 'no_show', 'late_cancel', 'correction')),
  note           text check (length(note) <= 500),
  day            date not null default public.today_lu(),
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid()
);
create index pt_ledger_client_idx on public.pt_ledger (client_id, day);

alter table public.locations enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_clients enable row level security;
alter table public.pt_ledger enable row level security;
revoke all on public.locations, public.appointments, public.appointment_clients, public.pt_ledger from anon, authenticated;
grant select, insert, update, delete on public.locations, public.appointments, public.appointment_clients to authenticated;
grant select, insert on public.pt_ledger to authenticated;
grant all on public.locations, public.appointments, public.appointment_clients, public.pt_ledger to service_role;

-- is the current client part of this appointment?
create function public.my_appointment(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.appointment_clients ac
                 where ac.appointment_id = aid and ac.client_id = public.my_client_id());
$$;
revoke execute on function public.my_appointment(uuid) from public, anon;
grant execute on function public.my_appointment(uuid) to authenticated;

create policy "coach manages locations" on public.locations
  for all to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()))
  with check (coach_id = (select auth.uid()) and (select public.is_coach()));
create policy "client reads coach locations" on public.locations
  for select to authenticated
  using (coach_id = (select public.my_coach_id()));

create policy "coach manages appointments" on public.appointments
  for all to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()))
  with check (coach_id = (select auth.uid()) and (select public.is_coach()));
create policy "client reads own appointments" on public.appointments
  for select to authenticated
  using ((select public.my_appointment(id)));

create policy "coach manages attendance" on public.appointment_clients
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));
create policy "client reads own attendance" on public.appointment_clients
  for select to authenticated
  using (client_id = (select public.my_client_id()));

create policy "read pt ledger" on public.pt_ledger
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));
create policy "coach books pt" on public.pt_ledger
  for insert to authenticated
  with check ((select public.is_my_client(client_id)));

-- current balance per client
create view public.pt_balance
with (security_invoker = true) as
  select client_id, sum(delta)::int as balance
  from public.pt_ledger
  group by client_id;
grant select on public.pt_balance to authenticated;

-- ---------------------------------------------------------------------------
-- Client confirms or cancels. Cancellations inside the window are marked late.
-- ---------------------------------------------------------------------------
create function public.client_respond_appointment(aid uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid := public.my_client_id();
  a public.appointments;
  hours int;
  is_late boolean;
begin
  if cid is null or not public.my_appointment(aid) then raise exception 'not allowed'; end if;
  select * into a from public.appointments where id = aid;
  if a.status <> 'planned' or a.starts_at < now() then raise exception 'appointment closed'; end if;

  if p_action = 'confirm' then
    update public.appointment_clients set status = 'confirmed', responded_at = now()
     where appointment_id = aid and client_id = cid;
    perform public.notify_coach(cid, 'appointment', 'Termin bestätigt',
      to_char(a.starts_at at time zone 'Europe/Luxembourg', 'DD.MM. HH24:MI'), '#/c/termine');
    return 'confirmed';
  elsif p_action = 'cancel' then
    select coalesce((s.settings ->> 'cancel_hours')::int, 24) into hours
      from public.coach_settings s where s.coach_id = a.coach_id;
    hours := coalesce(hours, 24);
    is_late := a.starts_at - now() < make_interval(hours => hours);
    update public.appointment_clients
       set status = 'cancelled_client', late_cancel = is_late, responded_at = now()
     where appointment_id = aid and client_id = cid;
    perform public.notify_coach(cid, 'appointment',
      case when is_late then 'Kurzfristige Absage' else 'Termin abgesagt' end,
      to_char(a.starts_at at time zone 'Europe/Luxembourg', 'DD.MM. HH24:MI'), '#/c/termine');
    return case when is_late then 'late' else 'cancelled' end;
  end if;
  raise exception 'invalid action';
end;
$$;
revoke execute on function public.client_respond_appointment(uuid, text) from public, anon;
grant execute on function public.client_respond_appointment(uuid, text) to authenticated;

-- attended -> -1 PT automatically (once); warn coach at <= 1 left
create function public.attendance_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bal int;
begin
  if new.status = 'attended' and (tg_op = 'INSERT' or old.status <> 'attended') then
    if not exists (select 1 from public.pt_ledger
                   where appointment_id = new.appointment_id and client_id = new.client_id and reason = 'session') then
      insert into public.pt_ledger (client_id, delta, reason, appointment_id, note)
      values (new.client_id, -1, 'session', new.appointment_id, 'Termin durchgeführt');
    end if;
    select coalesce(sum(delta), 0) into bal from public.pt_ledger where client_id = new.client_id;
    if bal <= 1 then
      perform public.notify_coach(new.client_id, 'pt_low',
        case when bal < 0 then 'PT-Guthaben im Minus' else 'Nur noch ' || bal || ' PT übrig' end,
        null, '#/c/kunde/' || new.client_id);
    end if;
  end if;
  -- undo: attended -> something else removes the automatic booking
  if tg_op = 'UPDATE' and old.status = 'attended' and new.status <> 'attended' then
    delete from public.pt_ledger
     where appointment_id = new.appointment_id and client_id = new.client_id and reason = 'session';
  end if;
  return new;
end;
$$;

create trigger appointment_clients_ledger after insert or update of status on public.appointment_clients
  for each row execute function public.attendance_ledger();

-- new appointment -> client is notified
create function public.attendance_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments where id = new.appointment_id;
  perform public.notify_client(new.client_id, 'appointment', 'Neuer PT-Termin',
    to_char(a.starts_at at time zone 'Europe/Luxembourg', 'DD.MM. HH24:MI'), '#/heute');
  return new;
end;
$$;

create trigger appointment_clients_notify after insert on public.appointment_clients
  for each row execute function public.attendance_notify();

-- workouts logged live during a PT session point to the appointment
alter table public.workouts
  add constraint workouts_appointment_fk
  foreign key (appointment_id) references public.appointments (id) on delete set null;
