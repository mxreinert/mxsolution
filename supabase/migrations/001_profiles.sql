-- 001_profiles: accounts and roles
--
-- One row per login (auth.users). Holds ONLY account data: role, username,
-- whether the start password must still be changed, and which coach owns the account.
-- Person data (birthdate, consent, goal, anamnesis) comes later in `clients`.
--
-- Who may do what:
--   client  -> may READ own row. Can never insert/update/delete (so never change own role).
--   coach   -> may READ rows of own clients, only with 2FA (aal2).
--   writes  -> only server-side with the service-role key (Netlify Function) or the SQL editor.

create type public.app_role as enum ('coach', 'client');

create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  role                 public.app_role not null default 'client',
  username             text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  coach_id             uuid references public.profiles (id) on delete restrict,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  -- a client always belongs to a coach, a coach never has one
  constraint client_has_coach check (
    (role = 'client' and coach_id is not null) or (role = 'coach' and coach_id is null)
  )
);

create index profiles_coach_id_idx on public.profiles (coach_id);

alter table public.profiles enable row level security;

-- "Automatically expose new tables" is off: grant explicitly, read-only.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- server functions (service-role key) create accounts and reset passwords
grant select, insert, update, delete on public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- Helper: is the caller a coach AND logged in with 2FA?
-- security definer so it can read profiles without triggering RLS recursion.
-- ---------------------------------------------------------------------------
create function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coach'
  )
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke execute on function public.is_coach() from public, anon;
grant execute on function public.is_coach() to authenticated;

-- ---------------------------------------------------------------------------
-- Policies (SELECT only, no write policies = no writes from the browser)
-- ---------------------------------------------------------------------------
create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "coach reads own clients"
  on public.profiles for select
  to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()));

-- ---------------------------------------------------------------------------
-- Password-change flag: cleared automatically when the password really changes.
-- The server function that sets a new start password sets it back to true
-- AFTER changing the password, so the order there matters.
-- ---------------------------------------------------------------------------
create function public.handle_password_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles set must_change_password = false where id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_password_changed() from public, anon, authenticated;

create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.handle_password_changed();
