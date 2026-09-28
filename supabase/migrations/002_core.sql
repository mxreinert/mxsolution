-- 002_core: clients (leads + customers), status history, notes, settings,
-- notifications and usage statistics.
--
-- Access pattern used in all following migrations:
--   client -> own rows only, via public.my_client_id()
--   coach  -> rows of own clients, via public.is_my_client(client_id) (requires 2FA)
--   Everything else: no access.

-- ---------------------------------------------------------------------------
-- Test accounts may skip 2FA. Only settable in the SQL editor.
-- LAUNCH.md: must be false for every account before real customers.
-- ---------------------------------------------------------------------------
alter table public.profiles add column mfa_exempt boolean not null default false;

create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'coach'
      and (coalesce(auth.jwt() ->> 'aal', '') = 'aal2' or p.mfa_exempt)
  );
$$;

-- Local date used for all "day" rules (entry windows etc.)
create function public.today_lu()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Luxembourg')::date $$;

grant execute on function public.today_lu() to authenticated;

-- ---------------------------------------------------------------------------
-- clients: one row per person (lead or customer). A login is attached later.
-- ---------------------------------------------------------------------------
create type public.client_status as enum (
  'lead',          -- Interessent, offen
  'concept',       -- Interessent, Konzept in Arbeit
  'active',        -- Kunde, aktiv
  'maintenance',   -- Erhaltung
  'reduced',       -- Reduziert
  'paused_sick',   -- Pause Krankheit/Verletzung
  'paused_other',  -- Pause Urlaub/sonstiges
  'ended',         -- Coaching beendet
  'discarded'      -- Interessent verworfen (wird nach 45 Tagen gelöscht)
);

create type public.goal as enum ('bulk', 'cut', 'endurance', 'fitness', 'recomp');

create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  coach_id           uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  user_id            uuid unique references public.profiles (id) on delete set null,
  status             public.client_status not null default 'lead',

  first_name         text not null check (length(first_name) between 1 and 80),
  last_name          text check (length(last_name) <= 80),
  phone              text check (length(phone) <= 40),
  first_contact      date not null default public.today_lu(),
  birthdate          date,

  -- consent (paper contract, date documented here)
  anamnesis_consent_at date,          -- consent to store anamnesis before a contract
  consent_at         date,            -- data protection consent (customer)
  parent_consent_at  date,            -- required if minor
  parent_name        text check (length(parent_name) <= 120),
  extra_consents     jsonb not null default '{}',  -- {"ai": "2026-10-01", "cycle": "...", "photos": "..."}

  -- concept
  goal               public.goal,
  goal_start         date,
  goal_end           date,
  milestones         text check (length(milestones) <= 4000),
  modules            text[] not null default '{}',   -- active modules, e.g. {strength,nutrition,weight}
  unlocks            text[] not null default '{}',   -- premium: {hevy,ai,photos,pt,free_training}
  targets            jsonb not null default '{}',    -- kcal, protein, carbs, fat, steps, sleep_h, weekly_change_kg, cardio ...
  anamnesis          jsonb not null default '{}',
  emergency          jsonb not null default '{}',    -- {name, relation, phone, notes}
  checkin_weekday    smallint not null default 0 check (checkin_weekday between 0 and 6), -- 0 = Sunday
  inactivity_days    smallint not null default 3 check (inactivity_days between 1 and 60),
  plan_review_at     date,

  -- status details
  status_reason      text,
  status_detail      text,
  status_until       date,
  status_since       timestamptz not null default now(),
  return_requested_at timestamptz,
  discarded_at       timestamptz,
  ended_at           date,

  avatar_path        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint discarded_has_date check (status <> 'discarded' or discarded_at is not null)
);

create index clients_coach_idx on public.clients (coach_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer: bypass RLS inside, no recursion)
-- ---------------------------------------------------------------------------
create function public.my_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select id from public.clients where user_id = auth.uid() $$;

create function public.my_coach_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select coach_id from public.clients where user_id = auth.uid() $$;

create function public.is_my_client(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_coach()
     and exists (select 1 from public.clients c where c.id = cid and c.coach_id = auth.uid());
$$;

-- Clients may only write entries for recent days (today and 3 days back, +1 for time zones)
create function public.client_day_ok(d date)
returns boolean
language sql
stable
set search_path = ''
as $$ select d between public.today_lu() - 3 and public.today_lu() + 1 $$;

revoke execute on function public.my_client_id(), public.my_coach_id(),
  public.is_my_client(uuid), public.client_day_ok(date) from public, anon;
grant execute on function public.my_client_id(), public.my_coach_id(),
  public.is_my_client(uuid), public.client_day_ok(date) to authenticated;

-- generic updated_at trigger
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS clients
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
revoke all on public.clients from anon, authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;

create policy "client reads own record" on public.clients
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "coach reads own clients" on public.clients
  for select to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()));

create policy "coach inserts own clients" on public.clients
  for insert to authenticated
  with check (coach_id = (select auth.uid()) and (select public.is_coach()) and user_id is null);

-- user_id is only ever set by the server function (service role); the coach cannot re-link logins
create policy "coach updates own clients" on public.clients
  for update to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()))
  with check (coach_id = (select auth.uid()));

-- only leads without login can be deleted from the browser; customers via server function
create policy "coach deletes own leads" on public.clients
  for delete to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()) and user_id is null);

-- Coach must not change user_id from the browser
create function public.protect_client_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id and current_user = 'authenticated' then
    raise exception 'user_id can only be changed server-side';
  end if;
  if new.status is distinct from old.status then
    new.status_since = now();
    if new.status = 'discarded' then new.discarded_at = coalesce(new.discarded_at, now()); end if;
    if old.status = 'discarded' and new.status <> 'discarded' then new.discarded_at = null; end if;
  end if;
  return new;
end;
$$;

create trigger clients_protect before update on public.clients
  for each row execute function public.protect_client_user_id();

-- ---------------------------------------------------------------------------
-- Status history (graphs show pauses as grey bands)
-- ---------------------------------------------------------------------------
create table public.client_status_log (
  id         bigint generated always as identity primary key,
  client_id  uuid not null references public.clients (id) on delete cascade,
  status     public.client_status not null,
  reason     text,
  detail     text,
  note       text check (length(note) <= 1000),
  until_date date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index client_status_log_client_idx on public.client_status_log (client_id, created_at);

alter table public.client_status_log enable row level security;
revoke all on public.client_status_log from anon, authenticated;
grant select, insert on public.client_status_log to authenticated;
grant all on public.client_status_log to service_role;

create policy "read status log" on public.client_status_log
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

create policy "coach writes status log" on public.client_status_log
  for insert to authenticated
  with check ((select public.is_my_client(client_id)));

-- log every status change automatically
create function public.log_client_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.client_status_log (client_id, status, reason, detail, until_date, created_by)
    values (new.id, new.status, new.status_reason, new.status_detail, new.status_until, auth.uid());
  end if;
  return new;
end;
$$;

create trigger clients_status_log after insert or update of status on public.clients
  for each row execute function public.log_client_status();

-- ---------------------------------------------------------------------------
-- Coach-only notes
-- ---------------------------------------------------------------------------
create table public.client_notes (
  id         bigint generated always as identity primary key,
  client_id  uuid not null references public.clients (id) on delete cascade,
  body       text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at);

alter table public.client_notes enable row level security;
revoke all on public.client_notes from anon, authenticated;
grant select, insert, update, delete on public.client_notes to authenticated;
grant all on public.client_notes to service_role;

create policy "coach manages notes" on public.client_notes
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

-- ---------------------------------------------------------------------------
-- Per-client settings the CLIENT may change (reminders, theme, devices, onboarding)
-- ---------------------------------------------------------------------------
create table public.client_settings (
  client_id        uuid primary key references public.clients (id) on delete cascade,
  reminders        jsonb not null default '{}',   -- {"weigh": {"on": true, "time": "07:00"}, ...}
  quiet_from       time not null default '22:00',
  quiet_to         time not null default '07:00',
  mute_until       timestamptz,
  theme            text check (theme in ('light', 'dark', 'white-blue', 'black-blue')),
  devices          jsonb not null default '{}',   -- {"watch": "garmin", "nutrition_app": "yazio"}
  onboarded_at     timestamptz,
  privacy_ack_at   timestamptz,
  cycle_enabled    boolean not null default true, -- client can switch off M14 herself
  updated_at       timestamptz not null default now()
);

create trigger client_settings_touch before update on public.client_settings
  for each row execute function public.touch_updated_at();

alter table public.client_settings enable row level security;
revoke all on public.client_settings from anon, authenticated;
grant select, insert, update on public.client_settings to authenticated;
grant all on public.client_settings to service_role;

create policy "read settings" on public.client_settings
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

create policy "client writes own settings" on public.client_settings
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

create policy "client updates own settings" on public.client_settings
  for update to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)))
  with check (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

-- ---------------------------------------------------------------------------
-- Coach settings (thresholds, texts, WhatsApp, cancellation window ...)
-- ---------------------------------------------------------------------------
create table public.coach_settings (
  coach_id   uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  settings   jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger coach_settings_touch before update on public.coach_settings
  for each row execute function public.touch_updated_at();

alter table public.coach_settings enable row level security;
revoke all on public.coach_settings from anon, authenticated;
grant select, insert, update on public.coach_settings to authenticated;
grant all on public.coach_settings to service_role;

create policy "coach manages own settings" on public.coach_settings
  for all to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()))
  with check (coach_id = (select auth.uid()) and (select public.is_coach()));

-- Clients get only the public part of their coach's settings
create function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
        'whatsapp', s.settings -> 'whatsapp',
        'faq', s.settings -> 'faq',
        'privacy_text', s.settings -> 'privacy_text',
        'cancel_hours', s.settings -> 'cancel_hours',
        'thresholds', s.settings -> 'thresholds',
        'help_text', s.settings -> 'help_text')
     from public.coach_settings s
     where s.coach_id = coalesce(public.my_coach_id(), auth.uid())),
    '{}'::jsonb);
$$;
revoke execute on function public.get_public_settings() from public, anon;
grant execute on function public.get_public_settings() to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications (in-app pop-ups; push is sent server-side from the same rows)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade, -- recipient
  client_id  uuid references public.clients (id) on delete cascade,           -- about whom
  kind       text not null,  -- feedback, plan, unlock, pain, pause, return, message, inactive, pt_low, appointment ...
  title      text not null check (length(title) <= 200),
  body       text check (length(body) <= 2000),
  link       text check (length(link) <= 300),
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  pushed_at  timestamptz
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

create policy "read own notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- internal helper: notify the login of a client / the coach of a client
create function public.notify_client(cid uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, client_id, kind, title, body, link)
  select c.user_id, c.id, p_kind, p_title, p_body, p_link
  from public.clients c where c.id = cid and c.user_id is not null;
$$;

create function public.notify_coach(cid uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, client_id, kind, title, body, link)
  select c.coach_id, c.id, p_kind, p_title, p_body, p_link
  from public.clients c where c.id = cid;
$$;

revoke execute on function public.notify_client(uuid, text, text, text, text),
  public.notify_coach(uuid, text, text, text, text) from public, anon, authenticated;

-- Coach sends a manual message to a client (in-app + push)
create function public.coach_send_message(cid uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_my_client(cid) then raise exception 'not allowed'; end if;
  perform public.notify_client(cid, 'message', left(p_title, 200), left(p_body, 2000), '#/heute');
end;
$$;
revoke execute on function public.coach_send_message(uuid, text, text) from public, anon;
grant execute on function public.coach_send_message(uuid, text, text) to authenticated;

-- notify client when modules/unlocks are added
create function public.notify_unlocks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  added text[];
begin
  select array_agg(u) into added
  from unnest(new.unlocks) u where not (u = any(old.unlocks));
  if added is not null and new.user_id is not null then
    perform public.notify_client(new.id, 'unlock', 'Neu für dich freigeschaltet',
      array_to_string(added, ', '), '#/profil');
  end if;
  return new;
end;
$$;

create trigger clients_notify_unlocks after update of unlocks on public.clients
  for each row execute function public.notify_unlocks();

-- ---------------------------------------------------------------------------
-- Client reports a pause (illness etc.) or asks to return. Only these two
-- status changes are allowed for clients, everything else is done by the coach.
-- ---------------------------------------------------------------------------
create function public.client_report_pause(p_reason text, p_detail text, p_until date, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid := public.my_client_id();
  new_status public.client_status;
begin
  if cid is null then raise exception 'no client'; end if;
  if p_reason not in ('illness', 'accident', 'injury', 'mental', 'vacation', 'other') then
    raise exception 'invalid reason';
  end if;
  new_status := case when p_reason in ('vacation', 'other') then 'paused_other' else 'paused_sick' end;

  update public.clients
     set status = new_status,
         status_reason = p_reason,
         -- no details are stored for mental health reasons
         status_detail = case when p_reason = 'mental' then null else left(p_detail, 300) end,
         status_until = p_until,
         return_requested_at = null
   where id = cid;

  update public.client_status_log
     set note = case when p_reason = 'mental' then null else left(p_note, 1000) end
   where id = (select max(id) from public.client_status_log where client_id = cid);

  perform public.notify_coach(cid, 'pause', 'Abmeldung: Kunde pausiert',
    case p_reason
      when 'illness' then 'Krankheit' when 'accident' then 'Unfall' when 'injury' then 'Verletzung'
      when 'mental' then 'Psychische Belastung – bitte melden' when 'vacation' then 'Urlaub' else 'Sonstiges' end,
    '#/c/kunde/' || cid);
end;
$$;

create function public.client_request_return()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid := public.my_client_id();
begin
  if cid is null then raise exception 'no client'; end if;
  update public.clients set return_requested_at = now() where id = cid;
  perform public.notify_coach(cid, 'return', 'Kunde meldet: wieder fit', null, '#/c/kunde/' || cid);
end;
$$;

revoke execute on function public.client_report_pause(text, text, date, text),
  public.client_request_return() from public, anon;
grant execute on function public.client_report_pause(text, text, date, text),
  public.client_request_return() to authenticated;

-- ---------------------------------------------------------------------------
-- Usage statistics: when the app was opened (disclosed in the privacy notice)
-- ---------------------------------------------------------------------------
create table public.app_opens (
  id        bigint generated always as identity primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  opened_at timestamptz not null default now()
);
create index app_opens_client_idx on public.app_opens (client_id, opened_at desc);

-- after 90 days individual opens are condensed to one row per day
create table public.app_opens_daily (
  client_id uuid not null references public.clients (id) on delete cascade,
  day       date not null,
  opens     int not null,
  primary key (client_id, day)
);

alter table public.app_opens enable row level security;
alter table public.app_opens_daily enable row level security;
revoke all on public.app_opens, public.app_opens_daily from anon, authenticated;
grant select, insert on public.app_opens to authenticated;
grant select on public.app_opens_daily to authenticated;
grant all on public.app_opens, public.app_opens_daily to service_role;

create policy "client logs own opens" on public.app_opens
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and opened_at > now() - interval '1 minute');

create policy "coach reads opens" on public.app_opens
  for select to authenticated
  using ((select public.is_my_client(client_id)));

create policy "coach reads daily opens" on public.app_opens_daily
  for select to authenticated
  using ((select public.is_my_client(client_id)));
