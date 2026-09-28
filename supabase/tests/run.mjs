// Runs the project's migrations against PGlite with a minimal Supabase stub, then RLS tests.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.REPO_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^/([A-Z]:)/, '$1')), '../..');
const db = new PGlite({ extensions: { pgcrypto } });

const STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;
grant usage on schema public to anon, authenticated, service_role;
create schema extensions; create extension pgcrypto with schema extensions;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text unique, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text);
create table auth.identities (id uuid primary key default gen_random_uuid(), provider_id text, user_id uuid references auth.users(id) on delete cascade,
  identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  email text generated always as (lower(identity_data->>'email')) stored);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant execute on function storage.foldername(text) to authenticated;
`;

async function runFile(label, sql) {
  try { await db.exec(sql); console.log('OK  ', label); return true; }
  catch (e) { console.log('FAIL', label, '\n   ', e.message, e.position ? `(pos ${e.position}: ${sql.slice(Math.max(0, e.position - 120), Number(e.position) + 60).replace(/\n/g, ' ')})` : ''); return false; }
}

await runFile('stub', STUB);
const files = [
  'supabase/migrations/001_profiles.sql', 'supabase/migrations/002_core.sql', 'supabase/migrations/003_tracking.sql',
  'supabase/migrations/004_training.sql', 'supabase/migrations/005_pt.sql', 'supabase/migrations/006_billing.sql',
  'supabase/migrations/007_integrations.sql', 'supabase/seed/exercises.sql', 'supabase/setup/test-accounts.local.sql'
];
for (const f of files) {
  const ok = await runFile(f, fs.readFileSync(path.join(ROOT, f), 'utf8'));
  if (!ok) process.exit(1);
}
fs.writeFileSync('db.ready', '1');
// expose for tests
globalThis.db = db;
const { runTests } = await import('./tests.mjs');
await runTests(db);
