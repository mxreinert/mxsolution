"""Build supabase/setup/ALLES-IN-EINEM.local.sql (gitignored): migrations + seed + coach + test accounts
in ONE transaction, for pasting into the Supabase SQL editor once.

Usage (repo root):  python supabase/setup/build_all_in_one.py coach-mail@example.com
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MIGRATIONS = sorted(f for f in os.listdir(os.path.join(ROOT, 'supabase', 'migrations')) if f.endswith('.sql'))
OUT = os.path.join(ROOT, 'supabase', 'setup', 'ALLES-IN-EINEM.local.sql')


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as f:
        return f.read()


def main():
    if len(sys.argv) < 2 or '@' not in sys.argv[1]:
        print(__doc__)
        return 1
    email = sys.argv[1].strip().lower().replace("'", '')
    out = io.StringIO()
    out.write('-- ALLES IN EINEM (lokal, nicht auf GitHub). Supabase: SQL Editor -> New query -> alles einfügen -> Run.\n'
              '-- Eine Transaktion: bei einem Fehler wird NICHTS gespeichert. Nur EINMAL ausführen.\n\nbegin;\n')
    for m in MIGRATIONS:
        out.write(f'\n-- ================================================================ migrations/{m}\n')
        out.write(read('supabase', 'migrations', m))
    seed = read('supabase', 'seed', 'exercises.sql').replace('begin;\n', '').replace('commit;\n', '')
    out.write('\n-- ================================================================ seed/exercises.sql\n' + seed)
    out.write(f"""
-- ================================================================ Coach-Konto
set constraints all immediate;
do $$
declare n int;
begin
  insert into public.profiles (id, role, username, must_change_password, coach_id)
  select id, 'coach', 'max', false, null from auth.users where lower(email) = '{email}'
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    raise notice 'Coach-Konto {email} nicht gefunden: in Authentication -> Users anlegen und supabase/setup/coach.sql ausführen.';
  end if;
end $$;
""")
    test_path = os.path.join(ROOT, 'supabase', 'setup', 'test-accounts.local.sql')
    if os.path.exists(test_path):
        out.write('\n-- ================================================================ Testzugänge\n' + read('supabase', 'setup', 'test-accounts.local.sql').split('-- Check')[0])
    out.write('\ncommit;\n\n-- Kontrolle\nselect p.username, p.role, u.email from public.profiles p join auth.users u on u.id = p.id order by p.role, p.username;\n')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out.getvalue())
    print('geschrieben:', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
