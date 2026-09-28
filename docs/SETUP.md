# Einrichtung der Coaching-App (app.mxreinert.de)

Schritt für Schritt, was Max selbst machen muss. Reihenfolge einhalten. Nichts davon kostet Geld.

> Geheime Werte (Secret Key, Passwörter, Verschlüsselungsschlüssel) **nie** in den Chat, ins Repo oder in Screenshots. Nur direkt bei Netlify/Supabase eintragen.

---

## 1. Datenbank in Supabase einrichten

Supabase → Projekt → **SQL Editor** → **New query**. Jede Datei einzeln: Inhalt komplett einfügen → **Run**. Nach jeder Datei muss unten „Success“ stehen. Wenn nicht: Fehlermeldung kopieren und Claude zeigen, **nicht** mit der nächsten Datei weitermachen.

| # | Datei | Was sie macht |
|---|---|---|
| 1 | `supabase/migrations/001_profiles.sql` | Konten und Rollen |
| 2 | `supabase/migrations/002_core.sql` | Kunden, Interessenten, Status, Einstellungen, Benachrichtigungen |
| 3 | `supabase/migrations/003_tracking.sql` | Abend-Check, Check-ins, Zyklus, Fotos, Supplemente, Dateispeicher |
| 4 | `supabase/migrations/004_training.sql` | Übungen, Pläne, Trainings, Cardio |
| 5 | `supabase/migrations/005_pt.sql` | Personal Training, Termine, PT-Guthaben |
| 6 | `supabase/migrations/006_billing.sql` | Preise und Buchhaltung |
| 7 | `supabase/migrations/007_integrations.sql` | Push, Hevy, KI, täglicher Wartungsjob |
| 8 | `supabase/seed/exercises.sql` | Deine 105 Übungen aus der Excel-Datei |
| 9 | `supabase/setup/coach.sql` | Dein Coach-Konto (vorher Mailadresse in der Datei ersetzen!) |
| 10 | `supabase/setup/test-accounts.local.sql` | Testzugänge mx67/mx68 (nur lokal, nicht auf GitHub) |

Danach in Supabase:
- **Authentication → Sign In / Providers → Email:** „Allow new users to sign up“ = **aus** (schon erledigt), „Minimum password length“ = **10**.
- **Authentication → Multi-Factor:** TOTP = **an**.

Wenn die Übungsliste später geändert wird: Excel bearbeiten → im Projektordner `python supabase/seed/generate_exercises.py` → neue `exercises.sql` wieder im SQL-Editor ausführen.

---

## 2. Lokal testen (kein Deploy nötig)

1. Claude bitten: „Starte die App lokal“ (oder selbst: `python -m http.server 5500 --directory apps/app/src`).
2. Im Browser **http://localhost:5500** öffnen.
3. Kundenansicht: `mx67@mail.com` / Passwort aus der Test-Datei. Coachansicht: `mx68@mail.com`.
4. Dein echtes Coach-Konto: deine Mail + Passwort → beim ersten Mal 2FA mit Authenticator-App einrichten.

Lokal funktioniert **alles außer** den Server-Funktionen (Kunden anlegen, Passwort zurücksetzen, Löschen, Hevy, KI, Push, Google Kalender). Die laufen erst auf Netlify.

---

## 3. Netlify: neue Site für die App

Erst wenn der lokale Test passt und du den Push freigegeben hast (2× fragen).

1. Netlify → **Add new project → Import an existing project → GitHub → mxreinert/mxsolution**.
2. Einstellungen:
   - Branch: `main`
   - Base directory: `apps/app`
   - Build command: leer
   - Publish directory: `apps/app/src`
   - Functions directory: `apps/app/netlify/functions`
3. **Environment variables** (Project configuration → Environment variables → Add):

| Name | Wert | Woher |
|---|---|---|
| `SUPABASE_URL` | `https://btatxcipmsvcriddxlhv.supabase.co` | öffentlich |
| `SUPABASE_ANON_KEY` | der `sb_publishable_…` Key | öffentlich |
| `SUPABASE_SERVICE_ROLE_KEY` | der `sb_secret_…` Key | Supabase → Project Settings → API Keys. **Geheim!** |
| `USERNAME_DOMAIN` | `kunden.mxreinert.de` | fest |
| `SECRETS_ENCRYPTION_KEY` | 32 Zufallsbytes (base64) | am PC erzeugen: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` – Ergebnis direkt einfügen, nirgends speichern außer Netlify + Passwort-Manager |
| `VAPID_PUBLIC_KEY` | `BJpXlCmy…XS88` (steht in `apps/app/src/core/config.js`) | öffentlich |
| `VAPID_PRIVATE_KEY` | aus der alten Bulk-Cockpit-Site kopieren | alte Netlify-Site → Environment variables. **Geheim!** |
| `VAPID_SUBJECT` | `mailto:deine-mail` | |
| `ANTHROPIC_API_KEY` | aus der alten Bulk-Cockpit-Site kopieren | **Geheim!** Ausgabenlimit in der Anthropic Console setzen |
| `AI_MODEL` | optional, Standard `claude-sonnet-5` | |
| `AI_DAILY_LIMIT` | optional, Standard `20` | |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID` | optional, siehe Abschnitt 5 | |

4. **Branches and deploy contexts:** Branch deploys = nur Production, Deploy Previews = aus.
5. Deploy starten, dann die Netlify-Adresse (`…netlify.app`) testen.

---

## 4. Domain app.mxreinert.de (IONOS)

1. Netlify → neue Site → **Domain management → Add a domain** → `app.mxreinert.de`.
2. IONOS → Domains → mxreinert.de → **DNS** → Eintrag hinzufügen:
   - Typ **CNAME**, Host `app`, Ziel = die Netlify-Adresse der Site (z. B. `mxreinert-app.netlify.app`).
3. Warten (bis zu 1 h), dann in Netlify „HTTPS“ prüfen (Zertifikat kommt automatisch).
4. Später: `bulk.mxreinert.de` auf die neue App umleiten, alte Sites (Bulk, KM Pacer) erst dann abschalten.

---

## 5. Optional: Google Kalender (PT-Termine)

Nur dein Kalender wird verbunden, Kunden bekommen „Zum Kalender hinzufügen“ (.ics).

1. console.cloud.google.com → neues Projekt → **Google Calendar API** aktivieren.
2. **OAuth consent screen:** Typ „External“, eigene Mail als Testnutzer, danach auf **„In production“** stellen (sonst läuft der Zugang nach 7 Tagen ab).
3. **Credentials → OAuth client ID** (Typ „Web application“), Redirect `https://developers.google.com/oauthplayground`.
4. developers.google.com/oauthplayground → Zahnrad → „Use your own OAuth credentials“ → Scope `https://www.googleapis.com/auth/calendar.events` → Autorisieren → „Exchange authorization code for tokens“ → **Refresh token** kopieren.
5. In Netlify eintragen: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, optional `GOOGLE_CALENDAR_ID` (Standard: Hauptkalender).

Hinweis Datenschutz: Termine mit Vornamen der Kunden liegen dann in deinem Google-Kalender (steht in LAUNCH.md).

---

## 6. Vor echten Kunden

`docs/LAUNCH.md` komplett abhaken, insbesondere: Testzugänge löschen (Block am Ende von `test-accounts.local.sql`), RLS mit zwei Testkunden prüfen, Backup einrichten.
