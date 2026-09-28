# mxreinert.de

Eigene Coaching-Plattform von Max (Fitness-Coach, Luxemburg). Kunden mit unterschiedlichen Zielen (Bulk, Cut, Laufen usw.) arbeiten hier mit mir zusammen. Es gibt zwei Rollen: **Coach** (ich) und **Kunde**.

**Keine Selbstregistrierung.** Kunden können sich nie selbst anmelden. Nur ich lege Kundenkonten in meinem Coach-Dashboard an.

Sprache im Code: Englisch (Variablen, Funktionen, Commits). Sprache in der Oberfläche: Deutsch.

## Struktur

```
mxreinert.de/
├── apps/
│   ├── landing/     → mxreinert.de (öffentliche Landingpage)
│   └── app/         → app.mxreinert.de (Coaching-App mit Login)
│       ├── src/                (Web-Root, wird so ausgeliefert)
│       │   ├── index.html, password.html, mfa.html   → Login, Passwortpflicht, 2FA
│       │   ├── home.html       → App-Hülle (Hash-Router)
│       │   ├── core/           → App-Kern: auth, db, router, ui, chart, metrics, goals, settings, modules (Registry), app (Kontext), shell
│       │   ├── client/         → Kunden-Bildschirme (Heute, Abend-Check, Training, Auswertung, Check-in, Profil …)
│       │   ├── coach/          → Coach-Dashboard (Übersicht, Kunden, Detail, Check-ins, Backup, Einstellungen …)
│       │   ├── modules/        → M1–M17, je ein Ordner mit index.js (Vertrag siehe core/modules.js)
│       │   └── vendor/         → supabase-js als Datei
│       └── netlify/functions/  → account, hevy, ai, gcal, reminders (alle 30 min), maintenance (täglich)
├── supabase/        → migrations/ (der Reihe nach), seed/ (Übungen), setup/ (einmalig)
├── docs/            → PLAN, SONDERFAELLE, LAUNCH, SETUP, DESIGN, RAHMENBEDINGUNGEN
└── CLAUDE.md
```

- Module sind Datenbereiche (Plan: M1–M17), Ziele sind nur Voreinstellungen, welche Module aktiv sind.
- Jedes Modul ist in sich abgeschlossen. Kein Modul importiert direkt aus einem anderen Modul, nur aus `core/`. Verbunden werden sie über die Registry in `core/modules.js`.
- KM Pacer liegt als eigenständige Offline-Seite unter `modules/cardio/pacer/` und übergibt Läufe über `localStorage` (`mx_pacer_outbox`) an das Cardio-Modul.
- Die alten Einzel-Repos (bulk-cockpit, kmpacer, mxreinert-web) liegen nur noch auf GitHub (dort archivieren, sobald die neue App live ist).
- Einrichtung: `docs/SETUP.md`. Vor echten Kunden: `docs/LAUNCH.md`.

## Stack

- Frontend: Vanilla HTML, CSS und JavaScript, kein Framework, kein Build-Schritt
- Serverseitig: Netlify Functions (`.mjs`)
- Backend: Supabase (Auth, Postgres, Row Level Security), Region EU
- Budget: nur Free-Tiers (Netlify, Supabase). Kostenpflichtige APIs (Anthropic, Hevy) nur pro Kunde freischaltbar
- Hosting: Netlify, zwei Sites aus diesem Repo (Base directory `apps/landing` bzw. `apps/app`)
- KM Pacer läuft als PWA im Browser

## Harte Regeln (Sicherheit und Datenschutz)

Die App verarbeitet Gesundheitsdaten, auch von Minderjährigen. Darum:

1. Im Frontend nur den öffentlichen anon-Key von Supabase. Der service-role-Key kommt nie in Client-Code und nie ins Repo.
2. Keine Secrets committen. Alles über Umgebungsvariablen, `.env` steht in `.gitignore`.
3. Jede Tabelle mit Kundendaten hat Row Level Security. Ein Kunde sieht nur seine eigenen Daten, der Coach sieht nur die Daten seiner Kunden.
4. Neue Tabelle heißt: RLS-Policy im selben Schritt schreiben und mir zeigen, bevor sie live geht.
5. Kunden können ihre Daten löschen und exportieren lassen. Bei neuen Features mitdenken.
6. Minderjährige Kunden brauchen Einwilligung der Eltern. Nichts bauen, was diese Prüfung umgeht.
7. Keine Analytics- oder Tracking-Dienste ohne Rücksprache.

### Konten und Registrierung

- In Supabase sind öffentliche Sign-ups deaktiviert. Es gibt keine Registrierungsseite und keinen Sign-up-Button in der App.
- Kundenkonten entstehen nur über das Coach-Dashboard. Das Anlegen läuft serverseitig (Netlify Function oder Supabase Edge Function) mit dem service-role-Key, der nur dort als Umgebungsvariable liegt.
- Diese Function prüft bei jedem Aufruf, dass der Aufrufer angemeldet ist und die Rolle Coach hat. Sonst wird abgelehnt.
- Beim Anlegen eines Kunden erfasse ich im Dashboard: Ziel, Geburtsdatum und Einwilligung (bei Minderjährigen die der Eltern). Ohne Einwilligung wird kein Konto erstellt.
- Login per Benutzername und Passwort, kein Mailversand. Intern nutzt Supabase eine Scheinadresse (`<username>@kunden.mxreinert.de`), an die nie etwas geschickt wird.
- Ich vergebe im Dashboard ein Startpasswort. Beim ersten Login muss der Kunde ein eigenes Passwort setzen, vorher geht nichts anderes. Die echten Passwörter kenne ich nie.
- Passwort vergessen: Ich setze ein neues Startpasswort, danach gilt wieder die Pflicht zum Ändern.
- Die Rolle (Coach/Kunde) wird nur serverseitig gesetzt. Ein Kunde kann seine Rolle nie selbst ändern, auch nicht über die API.
- Mein Coach-Konto wird manuell in Supabase angelegt und ist mit Zwei-Faktor-Authentifizierung geschützt.
- Kunden können ihr Konto nicht selbst löschen, aber Löschung und Export laufen über mich auf Anfrage.

## Arbeitsweise

- Bei jeder größeren Aufgabe zuerst einen Plan zeigen und auf mein OK warten.
- Immer nur eine Aufgabe pro Session, klein halten. Danach committen (nur lokal).

### Deploys (SEHR wichtig, Netlify-Limits)

- Jeder Push auf `main` löst einen Deploy aus. Darum: lokal committen, so oft nötig, aber **selten pushen**, lieber große gebündelte Updates.
- **Vor jedem Push/Deploy zweimal nachfragen** und auf zwei getrennte OKs von mir warten. Beim ersten Mal auflisten, was rausgeht.
- Nie selbst `netlify deploy` ausführen. Lokal testen statt Test-Deploys.
- Jede Netlify-Site baut nur, wenn sich ihr eigener Ordner geändert hat (`ignore`-Befehl in `netlify.toml`).
- Deploy Previews und Branch Deploys bleiben aus.
- Nichts löschen oder verschieben, ohne vorher aufzulisten, was betroffen ist.
- Bestehende Funktionen nicht ungefragt umschreiben. Nur ändern, was zur Aufgabe gehört.
- Wenn etwas unklar ist, nachfragen statt raten.
- Neue Abhängigkeiten nur nach Rückfrage.
- Nach Änderungen kurz sagen, was geprüft wurde und was nicht.
- Mobile first: Kunden nutzen die App fast nur am Handy.

## Befehle

Kein Build-Schritt, keine Tests bisher.

- Lokaler Server App: `python -m http.server 5500 --directory apps/app/src` → http://localhost:5500 (Konfiguration `app` in `.claude/launch.json`)
- Lokaler Server Landing: `python -m http.server 5501 --directory apps/landing/public` (Konfiguration `landing`). Netlify Functions laufen lokal nicht.
- Datenbank: SQL-Dateien in `supabase/migrations/` der Reihe nach im Supabase SQL-Editor ausführen, erst nach OK von Max. Einmalige Setups in `supabase/setup/`.
- Supabase-JS liegt als Datei in `apps/app/src/vendor/` (Version im Dateinamen), kein CDN.

## Status

- [x] Ordnerstruktur und Git-Repo angelegt
- [x] Landingpage nach `apps/landing` umgezogen, Netlify umgestellt
- [x] Gesamte App (Phase 1–3 aus PLAN.md) programmiert, lokal committet
- [x] SQL gegen PGlite-Nachbau getestet (48 RLS-Tests grün, `supabase/tests/`), UI mit Mock-Daten durchgeklickt (Kunde + Coach)
- [ ] SQL in Supabase eingespielt (`supabase/setup/ALLES-IN-EINEM.local.sql`, Max)
- [ ] Lokal gegen echtes Supabase getestet mit Testzugängen (Kunde + Coach), Fehler behoben
- [ ] Netlify-Site für app.mxreinert.de + Umgebungsvariablen + DNS (docs/SETUP.md)
- [ ] Design nach docs/DESIGN.md umgesetzt
- [ ] LAUNCH.md abgehakt, Testzugänge gelöscht
- [ ] Pilot mit 2-3 Kunden

Beim Abschluss eines Schritts hier abhaken.
