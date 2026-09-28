-- One-time setup: turn Max's manually created account into the coach profile.
-- Run once in the Supabase SQL editor AFTER 001_profiles.sql.
-- Replace the email below with the one used under Authentication -> Users.

insert into public.profiles (id, role, username, must_change_password, coach_id)
select id, 'coach', 'max', false, null
from auth.users
where email = 'DEINE-MAIL@BEISPIEL.DE';

-- Check: must return exactly one row with role = coach
select id, role, username, must_change_password from public.profiles;
