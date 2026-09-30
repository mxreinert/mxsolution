-- 012: clients can request an appointment (free text: what they need, when they can).
-- Max gets a notification (bell + push) and then creates the appointment himself.
--
-- New table public.appointment_requests with RLS:
--   * read:   the client her/his own requests, the coach the requests of his clients
--   * insert: only the client for her/himself, status 'open', max. 5 per 24 h (anti spam)
--   * update: the client may only withdraw an own open request (status -> 'cancelled');
--             the coach may answer/close requests of his clients
--   * delete: only the coach (data is also removed with the client, exported with the client export)

create table public.appointment_requests (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null default 'pt' check (kind in ('pt', 'call', 'other')),
  message     text not null check (length(btrim(message)) between 1 and 1000),
  status      text not null default 'open' check (status in ('open', 'scheduled', 'declined', 'cancelled')),
  coach_reply text check (length(coach_reply) <= 1000),
  created_at  timestamptz not null default now(),
  handled_at  timestamptz
);
create index appointment_requests_client_idx on public.appointment_requests (client_id, created_at desc);

alter table public.appointment_requests enable row level security;
revoke all on public.appointment_requests from anon, authenticated;
grant select, insert, delete on public.appointment_requests to authenticated;
grant update (status, coach_reply, handled_at) on public.appointment_requests to authenticated;
grant all on public.appointment_requests to service_role;

-- requests of the calling client in the last 24 h (security definer: no RLS recursion)
create function public.my_requests_last_day()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.appointment_requests r
  where r.client_id = public.my_client_id() and r.created_at > now() - interval '1 day';
$$;
revoke execute on function public.my_requests_last_day() from public, anon;
grant execute on function public.my_requests_last_day() to authenticated;

create policy "read requests" on public.appointment_requests
  for select to authenticated
  using (client_id = (select public.my_client_id()) or (select public.is_my_client(client_id)));

create policy "client sends request" on public.appointment_requests
  for insert to authenticated
  with check (client_id = (select public.my_client_id()) and status = 'open'
    and coach_reply is null and handled_at is null
    and public.my_requests_last_day() < 5);

create policy "client withdraws request" on public.appointment_requests
  for update to authenticated
  using (client_id = (select public.my_client_id()) and status = 'open')
  with check (client_id = (select public.my_client_id()) and status = 'cancelled' and coach_reply is null);

create policy "coach handles requests" on public.appointment_requests
  for update to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

create policy "coach deletes requests" on public.appointment_requests
  for delete to authenticated
  using ((select public.is_my_client(client_id)));

-- notify Max on a new request, notify the client when Max declines with a message
create function public.appointment_request_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
  what text := case new.kind when 'pt' then 'Personal Training' when 'call' then 'Online-Call' else 'Termin' end;
begin
  if tg_op = 'INSERT' then
    select c.first_name into who from public.clients c where c.id = new.client_id;
    perform public.notify_coach(new.client_id, 'request', 'Terminanfrage von ' || coalesce(who, 'Kunde') || ' (' || what || ')',
      left(new.message, 300), '#/c/termine');
  elsif new.status = 'declined' and old.status <> 'declined' then
    perform public.notify_client(new.client_id, 'message', 'Antwort auf deine Terminanfrage',
      coalesce(nullif(new.coach_reply, ''), 'Max kann den Termin leider nicht einrichten.'), '#/profil');
  end if;
  return new;
end;
$$;

create trigger appointment_requests_notify after insert or update of status on public.appointment_requests
  for each row execute function public.appointment_request_notify();
