-- 006_billing: M16 Preise & Buchhaltung. Coach only, clients see nothing.
-- No payment processing, no invoices: the app calculates and documents.
-- Amounts in cents (integer) to avoid rounding errors.

create table public.packages (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name          text not null check (length(name) between 1 and 120),
  kind          text not null check (kind in ('monthly', 'once', 'pt_block')),
  price_cents   int not null check (price_cents between 0 and 10000000),
  pt_units      smallint check (pt_units between 1 and 100),         -- for pt_block
  duration_days smallint check (duration_days between 1 and 3660),   -- optional runtime
  unlocks       text[] not null default '{}',                        -- set on assignment
  description   text check (length(description) <= 1000),
  active        boolean not null default true,
  replaced_by   uuid references public.packages (id) on delete set null, -- price versioning
  created_at    timestamptz not null default now()
);

create table public.client_packages (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  package_id      uuid not null references public.packages (id) on delete restrict,
  price_cents     int not null check (price_cents >= 0),        -- snapshot at booking time
  discount_cents  int not null default 0 check (discount_cents >= 0),
  discount_note   text check (length(discount_note) <= 200),
  start_date      date not null default public.today_lu(),
  end_date        date,
  status          text not null default 'active' check (status in ('active', 'ended')),
  created_at      timestamptz not null default now()
);
create index client_packages_client_idx on public.client_packages (client_id);

create table public.charges (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  client_package_id uuid references public.client_packages (id) on delete set null,
  amount_cents      int not null check (amount_cents >= 0),
  due_date          date not null,
  description       text not null check (length(description) <= 200),
  cancelled         boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (client_package_id, due_date)
);
create index charges_client_idx on public.charges (client_id, due_date);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  charge_id     uuid references public.charges (id) on delete set null,
  amount_cents  int not null check (amount_cents > 0),
  paid_on       date not null default public.today_lu(),
  method        text not null default 'cash' check (method in ('cash', 'transfer', 'other')),
  note          text check (length(note) <= 300),
  created_at    timestamptz not null default now()
);
create index payments_client_idx on public.payments (client_id, paid_on);

alter table public.packages enable row level security;
alter table public.client_packages enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
revoke all on public.packages, public.client_packages, public.charges, public.payments from anon, authenticated;
grant select, insert, update, delete on public.packages, public.client_packages, public.charges, public.payments to authenticated;
grant all on public.packages, public.client_packages, public.charges, public.payments to service_role;

create policy "coach manages packages" on public.packages
  for all to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()))
  with check (coach_id = (select auth.uid()) and (select public.is_coach()));

create policy "coach manages client packages" on public.client_packages
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

create policy "coach manages charges" on public.charges
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

create policy "coach manages payments" on public.payments
  for all to authenticated
  using ((select public.is_my_client(client_id)))
  with check ((select public.is_my_client(client_id)));

-- Open amount per client
create view public.client_balance
with (security_invoker = true) as
  select c.id as client_id,
         coalesce((select sum(amount_cents) from public.charges ch where ch.client_id = c.id and not ch.cancelled), 0)::int as charged_cents,
         coalesce((select sum(amount_cents) from public.payments p where p.client_id = c.id), 0)::int as paid_cents
  from public.clients c;
grant select on public.client_balance to authenticated;
