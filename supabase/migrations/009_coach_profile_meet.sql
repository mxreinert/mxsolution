-- 009_coach_profile_meet
-- 1. Online calls: appointment kind 'call' + Google Meet link
-- 2. Coach profile picture in storage (folder coach/<coach id>/)
-- 3. Public contact (WhatsApp number) for the login page – only this one value is public

-- ---------------------------------------------------------------------------
-- 1. Online calls
-- ---------------------------------------------------------------------------
alter table public.appointments drop constraint if exists appointments_kind_check;
alter table public.appointments add constraint appointments_kind_check
  check (kind in ('strength', 'cardio', 'technique', 'test', 'call', 'other'));

alter table public.appointments add column if not exists meet_url text
  check (meet_url is null or meet_url ~ '^https://');

-- ---------------------------------------------------------------------------
-- 2. Coach avatar: coach/<coach id>/avatar.jpg
--    write: only the coach himself; read: every logged-in user (clients see their coach)
-- ---------------------------------------------------------------------------
create policy "coach files read" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-files' and (storage.foldername(name))[1] = 'coach');

create policy "coach files insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-files' and (storage.foldername(name))[1] = 'coach'
    and (storage.foldername(name))[2] = (select auth.uid())::text and (select public.is_coach()));

create policy "coach files update" on storage.objects
  for update to authenticated
  using (bucket_id = 'client-files' and (storage.foldername(name))[1] = 'coach'
    and (storage.foldername(name))[2] = (select auth.uid())::text and (select public.is_coach()));

create policy "coach files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-files' and (storage.foldername(name))[1] = 'coach'
    and (storage.foldername(name))[2] = (select auth.uid())::text and (select public.is_coach()));

-- the existing client-folder policies cast the first folder to uuid; 'coach' is not a uuid.
-- Recreate them so they skip the coach folder instead of failing.
drop policy if exists "client files read" on storage.objects;
drop policy if exists "client files insert" on storage.objects;
drop policy if exists "client files update" on storage.objects;
drop policy if exists "client files delete" on storage.objects;

create function public.client_folder_ok(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select folder ~ '^[0-9a-f-]{36}$'
     and (folder = public.my_client_id()::text or public.is_my_client(folder::uuid));
$$;
revoke execute on function public.client_folder_ok(text) from public, anon;
grant execute on function public.client_folder_ok(text) to authenticated;

create policy "client files read" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-files' and public.client_folder_ok((storage.foldername(name))[1]));
create policy "client files insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-files' and public.client_folder_ok((storage.foldername(name))[1]));
create policy "client files update" on storage.objects
  for update to authenticated
  using (bucket_id = 'client-files' and public.client_folder_ok((storage.foldername(name))[1]));
create policy "client files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-files' and public.client_folder_ok((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- 3. Public contact for the login page (anon): only the coach's WhatsApp number + avatar path
-- ---------------------------------------------------------------------------
create function public.public_contact()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('whatsapp', s.settings ->> 'whatsapp')
  from public.coach_settings s
  join public.profiles p on p.id = s.coach_id
  where p.role = 'coach' and not p.mfa_exempt
  order by p.created_at
  limit 1;
$$;
revoke execute on function public.public_contact() from public;
grant execute on function public.public_contact() to anon, authenticated;

-- clients may see their coach's name + avatar info
create function public.my_coach()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'name', s.settings ->> 'display_name')
  from public.profiles p
  left join public.coach_settings s on s.coach_id = p.id
  where p.id = public.my_coach_id();
$$;
revoke execute on function public.my_coach() from public, anon;
grant execute on function public.my_coach() to authenticated;
