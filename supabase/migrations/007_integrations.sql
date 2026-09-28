-- 007_integrations: push subscriptions, secrets for integrations (Hevy),
-- AI analyses (coach only), data maintenance used by scheduled functions.

-- ---------------------------------------------------------------------------
-- Web push subscriptions (one per device)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://'),
  p256dh     text not null,
  auth_key   text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Integration secrets: never readable from the browser (no grants).
-- Values are AES-GCM encrypted by the Netlify function before storing.
-- ---------------------------------------------------------------------------
create table public.integration_secrets (
  client_id     uuid primary key references public.clients (id) on delete cascade,
  hevy_key_enc  text,
  hevy_synced_at timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from anon, authenticated;
grant all on public.integration_secrets to service_role;

-- the browser may only ask whether a Hevy key is stored
create function public.hevy_status(cid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'connected', s.hevy_key_enc is not null,
    'synced_at', s.hevy_synced_at)
  from public.integration_secrets s
  where s.client_id = cid
    and (cid = public.my_client_id() or public.is_my_client(cid));
$$;
revoke execute on function public.hevy_status(uuid) from public, anon;
grant execute on function public.hevy_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- M10 AI analyses (coach reviews them first, plan section M10)
-- ---------------------------------------------------------------------------
create table public.ai_analyses (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  period_from date not null,
  period_to   date not null,
  model       text not null,
  result      text not null,
  created_at  timestamptz not null default now()
);
create index ai_analyses_client_idx on public.ai_analyses (client_id, created_at desc);

alter table public.ai_analyses enable row level security;
revoke all on public.ai_analyses from anon, authenticated;
grant select, delete on public.ai_analyses to authenticated;
grant all on public.ai_analyses to service_role;

create policy "coach reads analyses" on public.ai_analyses
  for select to authenticated
  using ((select public.is_my_client(client_id)));
create policy "coach deletes analyses" on public.ai_analyses
  for delete to authenticated
  using ((select public.is_my_client(client_id)));

-- ---------------------------------------------------------------------------
-- Maintenance (called daily by the scheduled Netlify function, service role)
-- ---------------------------------------------------------------------------
create function public.run_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_leads int;
  condensed int;
  inactive int := 0;
  r record;
begin
  -- 1. discarded leads older than 45 days are deleted (health data without contract)
  delete from public.clients
   where status = 'discarded' and discarded_at < now() - interval '45 days' and user_id is null;
  get diagnostics deleted_leads = row_count;

  -- 2. usage statistics: condense individual opens older than 90 days to daily counts
  insert into public.app_opens_daily (client_id, day, opens)
  select client_id, (opened_at at time zone 'Europe/Luxembourg')::date, count(*)
    from public.app_opens
   where opened_at < now() - interval '90 days'
   group by 1, 2
  on conflict (client_id, day) do update set opens = public.app_opens_daily.opens + excluded.opens;
  delete from public.app_opens where opened_at < now() - interval '90 days';
  get diagnostics condensed = row_count;

  -- 3. inactivity: active clients who did not open the app for X days (once per day)
  for r in
    select c.id, c.first_name, c.inactivity_days,
           (select max(opened_at) from public.app_opens o where o.client_id = c.id) as last_open
      from public.clients c
     where c.status in ('active', 'maintenance', 'reduced') and c.user_id is not null
  loop
    if (r.last_open is null or r.last_open < now() - make_interval(days => r.inactivity_days))
       and not exists (select 1 from public.notifications n
                        where n.client_id = r.id and n.kind = 'inactive'
                          and n.created_at > now() - interval '20 hours') then
      perform public.notify_coach(r.id, 'inactive',
        r.first_name || ' hat die App seit ' || r.inactivity_days || '+ Tagen nicht geöffnet', null,
        '#/c/kunde/' || r.id);
      inactive := inactive + 1;
    end if;
  end loop;

  -- 4. long pauses: ask coach after 14 days (once a week)
  for r in
    select c.id, c.first_name from public.clients c
     where c.status in ('paused_sick', 'paused_other') and c.status_since < now() - interval '14 days'
  loop
    if not exists (select 1 from public.notifications n
                    where n.client_id = r.id and n.kind = 'pause_long'
                      and n.created_at > now() - interval '7 days') then
      perform public.notify_coach(r.id, 'pause_long', r.first_name || ' ist seit über 14 Tagen pausiert',
        'Status prüfen', '#/c/kunde/' || r.id);
    end if;
  end loop;

  return jsonb_build_object('deleted_leads', deleted_leads, 'condensed_opens', condensed, 'inactive_alerts', inactive);
end;
$$;
revoke execute on function public.run_daily_maintenance() from public, anon, authenticated;
grant execute on function public.run_daily_maintenance() to service_role;
