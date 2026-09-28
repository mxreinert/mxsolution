# Datenbank-Tests (lokal, ohne Supabase)

Spielt alle Migrationen, den Übungs-Seed und die Testzugänge in eine lokale Postgres-Kopie
(PGlite) mit einer minimalen Supabase-Nachbildung und prüft die Row Level Security
(48 Tests: Kunde sieht nur Eigenes, Coach nur mit 2FA und nur eigene Kunden, Trigger usw.).

PGlite ist **keine** Projekt-Abhängigkeit. Zum Ausführen in einem temporären Ordner installieren:

```
mkdir %TEMP%\sqltest && cd %TEMP%\sqltest && npm init -y && npm i @electric-sql/pglite
copy <repo>\supabase\tests\*.mjs .
set REPO_ROOT=<repo>
node run.mjs
```

Vor jeder neuen Migration laufen lassen, bevor sie in Supabase eingespielt wird.
Hinweis: `test-accounts.local.sql` ist gitignored und muss lokal vorhanden sein.
