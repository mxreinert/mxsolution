// RLS / trigger behaviour tests against the migrated PGlite database.
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, info); } };

async function as(db, userId, aal, fn) {
  await db.exec(`reset role;`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`,
    [userId || '', JSON.stringify(userId ? { sub: userId, aal, role: 'authenticated' } : {})]);
  await db.exec(`set role authenticated;`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
}
async function tryQ(db, sql, params = []) {
  try { const r = await db.query(sql, params); return { rows: r.rows, affected: r.affectedRows ?? r.rows.length }; }
  catch (e) { return { error: e.message }; }
}

export async function runTests(db) {
  console.log('\nRLS tests');
  const ids = Object.fromEntries((await db.query(`select email, id from auth.users`)).rows.map((r) => [r.email, r.id]));
  const client = ids['mx67@mail.com'], tcoach = ids['mx68@mail.com'];
  const cid = (await db.query(`select id from public.clients where user_id = $1`, [client])).rows[0].id;

  // second coach, not exempt, with own client
  await db.exec(`
    insert into auth.users (id, email, encrypted_password) values ('11111111-1111-1111-1111-111111111111', 'other@x.de', 'x');
    insert into public.profiles (id, role, username, must_change_password) values ('11111111-1111-1111-1111-111111111111', 'coach', 'other', false);
    insert into auth.users (id, email, encrypted_password) values ('22222222-2222-2222-2222-222222222222', 'c2@kunden.mxreinert.de', 'x');
    insert into public.profiles (id, role, username, coach_id) values ('22222222-2222-2222-2222-222222222222', 'client', 'kunde2', '11111111-1111-1111-1111-111111111111');
    insert into public.clients (id, coach_id, user_id, status, first_name, modules) values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'active', 'Fremd', '{weight}');
  `);
  const other = '11111111-1111-1111-1111-111111111111', otherClientUser = '22222222-2222-2222-2222-222222222222', otherCid = '33333333-3333-3333-3333-333333333333';

  // ---------- client ----------
  await as(db, client, 'aal1', async () => {
    let r = await tryQ(db, `select id from public.clients`);
    ok('client sees exactly own client row', r.rows?.length === 1 && r.rows[0].id === cid, JSON.stringify(r));
    r = await tryQ(db, `select id from public.profiles`);
    ok('client sees only own profile', r.rows?.length === 1, JSON.stringify(r));
    r = await tryQ(db, `update public.clients set status = 'ended' where id = $1`, [cid]);
    ok('client cannot update own client row', r.error || r.affected === 0, JSON.stringify(r));
    r = await tryQ(db, `update public.profiles set role = 'coach' where id = $1`, [client]);
    ok('client cannot change own role', !!r.error, JSON.stringify(r));
    r = await tryQ(db, `insert into public.daily_entries (client_id, day, weight_kg) values ($1, public.today_lu(), 72.5)`, [cid]);
    ok('client inserts today entry', !r.error, r.error);
    r = await tryQ(db, `insert into public.daily_entries (client_id, day, weight_kg) values ($1, public.today_lu() - 10, 72.5)`, [cid]);
    ok('client cannot insert entry 10 days back', !!r.error);
    r = await tryQ(db, `insert into public.daily_entries (client_id, day, weight_kg) values ($1, public.today_lu(), 80)`, [otherCid]);
    ok('client cannot write for another client', !!r.error);
    r = await tryQ(db, `select * from public.daily_entries where client_id = $1`, [otherCid]);
    ok('client cannot read other client entries', r.rows?.length === 0, JSON.stringify(r));
    r = await tryQ(db, `select * from public.client_notes`);
    ok('client cannot read coach notes', r.error || r.rows.length === 0);
    r = await tryQ(db, `select * from public.packages`);
    ok('client cannot read billing', r.error || r.rows.length === 0);
    r = await tryQ(db, `select * from public.integration_secrets`);
    ok('client cannot read secrets', !!r.error);
    r = await tryQ(db, `insert into public.workouts (id, client_id, day, kind) values (gen_random_uuid(), $1, public.today_lu(), 'free')`, [cid]);
    ok('client logs free workout (unlocked)', !r.error, r.error);
    r = await tryQ(db, `insert into public.checkins (client_id, week_start, rating) values ($1, date_trunc('week', now())::date, 4) returning id`, [cid]);
    ok('client submits check-in', !r.error, r.error);
    r = await tryQ(db, `update public.checkins set feedback = 'hack' where client_id = $1`, [cid]);
    ok('client cannot write feedback', !!r.error, JSON.stringify(r));
    r = await tryQ(db, `insert into storage.objects (bucket_id, name) values ('client-files', $1)`, [`${cid}/avatar.jpg`]);
    ok('client uploads to own folder', !r.error, r.error);
    r = await tryQ(db, `insert into storage.objects (bucket_id, name) values ('client-files', $1)`, [`${otherCid}/avatar.jpg`]);
    ok('client cannot upload to other folder', !!r.error);
    r = await tryQ(db, `select public.get_public_settings()`);
    ok('client reads public coach settings', !r.error, r.error);
    r = await tryQ(db, `select public.client_report_pause('illness', 'Fieber', null, 'krank')`);
    ok('client reports pause', !r.error, r.error);
    r = await tryQ(db, `select status from public.clients`);
    ok('status is paused_sick', r.rows?.[0]?.status === 'paused_sick', JSON.stringify(r));
    r = await tryQ(db, `select public.client_request_return()`);
    ok('client requests return', !r.error, r.error);
    r = await tryQ(db, `insert into public.app_opens (client_id) values ($1)`, [cid]);
    ok('client logs app open', !r.error, r.error);
  });

  // ---------- test coach (mfa_exempt, aal1) ----------
  await as(db, tcoach, 'aal1', async () => {
    let r = await tryQ(db, `select id from public.clients`);
    ok('test coach (exempt) sees own client', r.rows?.length === 1 && r.rows[0].id === cid, JSON.stringify(r));
    r = await tryQ(db, `select id from public.clients where id = $1`, [otherCid]);
    ok('test coach cannot see other coach client', r.rows?.length === 0);
    r = await tryQ(db, `select title, kind from public.notifications`);
    ok('coach got pause + return notifications', r.rows?.some((n) => n.kind === 'pause') && r.rows?.some((n) => n.kind === 'return'), JSON.stringify(r.rows));
    r = await tryQ(db, `update public.checkins set feedback = 'Gute Woche!' where client_id = $1`, [cid]);
    ok('coach writes feedback', !r.error && r.affected >= 0, r.error);
    await tryQ(db, `update public.clients set unlocks = array_remove(unlocks, 'photos') where id = $1`, [cid]);
    r = await tryQ(db, `update public.clients set status = 'active', unlocks = array_append(unlocks, 'photos') where id = $1`, [cid]);
    ok('coach updates client', !r.error, r.error);
    r = await tryQ(db, `update public.clients set user_id = null where id = $1`, [cid]);
    ok('coach cannot change user_id', !!r.error, JSON.stringify(r));
    r = await tryQ(db, `insert into public.clients (first_name) values ('Lead') returning id, coach_id`);
    ok('coach creates lead with own coach_id', r.rows?.[0]?.coach_id === tcoach, JSON.stringify(r));
    const leadId = r.rows?.[0]?.id;
    r = await tryQ(db, `update public.clients set status = 'discarded' where id = $1 returning discarded_at`, [leadId]);
    ok('discarding sets discarded_at', !!r.rows?.[0]?.discarded_at, JSON.stringify(r));
    r = await tryQ(db, `insert into public.client_notes (client_id, body) values ($1, 'Notiz')`, [cid]);
    ok('coach writes note', !r.error, r.error);
    r = await tryQ(db, `insert into public.training_plans (client_id, name, sessions) values ($1, 'Plan', '[]') returning id`, [cid]);
    ok('coach assigns plan', !r.error, r.error);
    r = await tryQ(db, `insert into public.locations (name) values ('Studio') returning id`);
    const loc = r.rows?.[0]?.id;
    r = await tryQ(db, `insert into public.appointments (starts_at, location_id) values (now() + interval '3 days', $1) returning id`, [loc]);
    ok('coach creates appointment', !r.error, r.error);
    const appt = r.rows?.[0]?.id;
    r = await tryQ(db, `insert into public.appointment_clients (appointment_id, client_id) values ($1, $2)`, [appt, cid]);
    ok('coach adds client to appointment', !r.error, r.error);
    r = await tryQ(db, `insert into public.pt_ledger (client_id, delta, reason) values ($1, 10, 'block')`, [cid]);
    ok('coach books PT block', !r.error, r.error);
    r = await tryQ(db, `update public.appointment_clients set status = 'attended' where appointment_id = $1`, [appt]);
    r = await tryQ(db, `select balance from public.pt_balance where client_id = $1`, [cid]);
    ok('attended books -1 (balance 9)', r.rows?.[0]?.balance === 9, JSON.stringify(r));
    r = await tryQ(db, `insert into public.packages (name, kind, price_cents) values ('Monat', 'monthly', 9900) returning id`);
    ok('coach creates package', !r.error, r.error);
    r = await tryQ(db, `select public.coach_send_message($1, 'Hallo', 'Test')`, [cid]);
    ok('coach sends message', !r.error, r.error);
    r = await tryQ(db, `select public.coach_send_message($1, 'Hallo', 'Test')`, [otherCid]);
    ok('coach cannot message foreign client', !!r.error);
  });

  // ---------- other coach without 2FA ----------
  await as(db, other, 'aal1', async () => {
    const r = await tryQ(db, `select id from public.clients`);
    ok('coach without 2FA sees no clients', r.rows?.length === 0, JSON.stringify(r));
  });
  await as(db, other, 'aal2', async () => {
    const r = await tryQ(db, `select id from public.clients`);
    ok('coach with 2FA sees only own client', r.rows?.length === 1 && r.rows[0].id === otherCid, JSON.stringify(r));
  });

  // ---------- client after coach actions ----------
  await as(db, client, 'aal1', async () => {
    let r = await tryQ(db, `select kind from public.notifications`);
    ok('client got feedback, unlock, plan, appointment, message notifications',
      ['feedback', 'unlock', 'plan', 'appointment', 'message'].every((k) => r.rows?.some((n) => n.kind === k)), JSON.stringify(r.rows));
    r = await tryQ(db, `select * from public.appointments`);
    ok('client sees own appointment', r.rows?.length === 1, JSON.stringify(r.rows?.length));
    r = await tryQ(db, `select * from public.locations`);
    ok('client sees coach locations', r.rows?.length === 1);
    r = await tryQ(db, `update public.notifications set read_at = now()`);
    ok('client marks notifications read', !r.error, r.error);
    r = await tryQ(db, `update public.notifications set title = 'x'`);
    ok('client cannot edit notification text', !!r.error);
  });

  // ---------- password flag trigger ----------
  await db.exec(`update public.profiles set must_change_password = true where id = '${client}'`);
  await db.exec(`update auth.users set encrypted_password = 'new' where id = '${client}'`);
  const mc = (await db.query(`select must_change_password from public.profiles where id = $1`, [client])).rows[0].must_change_password;
  ok('password change clears must_change_password', mc === false);

  // ---------- maintenance ----------
  await db.exec(`update public.clients set discarded_at = now() - interval '50 days' where status = 'discarded'`);
  const m = (await db.query(`select public.run_daily_maintenance() as r`)).rows[0].r;
  ok('maintenance deletes old discarded lead', m.deleted_leads === 1, JSON.stringify(m));

  // ---------- 009: coach avatar folder, public contact, calls ----------
  await db.exec(`update public.coach_settings set settings = settings || '{"whatsapp":"352621969685"}' where coach_id = '${tcoach}'`);
  await as(db, client, 'aal1', async () => {
    let r = await tryQ(db, `insert into storage.objects (bucket_id, name) values ('client-files', $1)`, [`coach/${tcoach}/avatar.jpg`]);
    ok('client cannot upload into coach folder', !!r.error);
    r = await tryQ(db, `insert into storage.objects (bucket_id, name) values ('client-files', $1)`, [`${cid}/photos/x.jpg`]);
    ok('client still uploads own photos (009 policies)', !r.error, r.error);
  });
  await as(db, tcoach, 'aal1', async () => {
    let r = await tryQ(db, `insert into storage.objects (bucket_id, name) values ('client-files', $1)`, [`coach/${tcoach}/avatar.jpg`]);
    ok('coach uploads own avatar', !r.error, r.error);
    r = await tryQ(db, `insert into storage.objects (bucket_id, name) values ('client-files', $1)`, [`coach/${other}/avatar.jpg`]);
    ok('coach cannot write other coach folder', !!r.error);
    r = await tryQ(db, `insert into public.appointments (starts_at, kind, meet_url) values (now() + interval '1 day', 'call', 'https://meet.google.com/abc-defg-hij') returning id`);
    ok('coach creates online call with meet link', !r.error, r.error);
  });
  await as(db, client, 'aal1', async () => {
    const r = await tryQ(db, `select name from storage.objects where name like 'coach/%'`);
    ok('client sees coach avatar', r.rows?.length === 1, JSON.stringify(r));
    const c = await tryQ(db, `select public.my_coach() as c`);
    ok('client reads own coach info', c.rows?.[0]?.c?.username === 'testcoach', JSON.stringify(c.rows));
  });
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  const pc = await tryQ(db, `select public.public_contact() as c`);
  ok('anon gets only public contact', !pc.error, pc.error);
  const pc2 = await tryQ(db, `select * from public.coach_settings`);
  ok('anon cannot read coach settings', !!pc2.error || pc2.rows.length === 0);
  await db.exec('reset role;');

  // ---------- 011: cardio types, period end, 5 days back ----------
  await as(db, client, 'aal1', async () => {
    let r = await tryQ(db, `insert into public.cycle_entries (client_id, start_date) values ($1, public.today_lu() - 3)`, [cid]);
    ok('client adds period start', !r.error, r.error);
    r = await tryQ(db, `update public.cycle_entries set end_date = public.today_lu() where client_id = $1 and start_date = public.today_lu() - 3`, [cid]);
    ok('client sets period end', !r.error && r.affected === 1, r.error || r.affected);
    r = await tryQ(db, `update public.cycle_entries set end_date = public.today_lu() + 20 where client_id = $1`, [cid]);
    ok('period end > 14 days rejected', !!r.error);
    r = await tryQ(db, `update public.cycle_entries set start_date = public.today_lu() - 1 where client_id = $1`, [cid]);
    ok('client cannot move period start', !!r.error);
    r = await tryQ(db, `insert into public.cardio_sessions (id, client_id, day, kind, duration_min) values (gen_random_uuid(), $1, public.today_lu(), 'hiit', 20)`, [cid]);
    ok('client logs new cardio type hiit', !r.error, r.error);
    r = await tryQ(db, `insert into public.cardio_sessions (id, client_id, day, kind, duration_min) values (gen_random_uuid(), $1, public.today_lu(), 'teleport', 20)`, [cid]);
    ok('unknown cardio type rejected', !!r.error);
    r = await tryQ(db, `insert into public.cardio_sessions (id, client_id, day, kind, duration_min) values (gen_random_uuid(), $1, public.today_lu() - 5, 'run', 20)`, [cid]);
    ok('client logs 5 days back', !r.error, r.error);
    r = await tryQ(db, `insert into public.cardio_sessions (id, client_id, day, kind, duration_min) values (gen_random_uuid(), $1, public.today_lu() - 6, 'run', 20)`, [cid]);
    ok('client cannot log 6 days back', !!r.error);
  });
  await as(db, tcoach, 'aal1', async () => {
    const r = await tryQ(db, `update public.cycle_entries set end_date = null where client_id = $1`, [cid]);
    ok('coach cannot change period entries', !!r.error || r.affected === 0, r.error || r.affected);
  });

  // ---------- anon ----------
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  const an = await tryQ(db, `select * from public.clients`);
  ok('anon has no access', !!an.error || an.rows.length === 0);
  await db.exec('reset role;');

  console.log(`\n${pass} passed, ${fail} failed`);
}
