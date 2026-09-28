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
│       └── src/modules/
│           ├── bulk/     → Bulk Cockpit (Tracker für Bulk/Cut)
│           └── pacer/    → KM Pacer (Pace-Vorgabe während des Laufs)
├── packages/
│   └── shared/      → nur anlegen, wenn Code wirklich doppelt vorkommt
├── supabase/        → Schema, Migrationen, Row Level Security
└── CLAUDE.md
```

- Bulk Cockpit und KM Pacer sind **Module** der App, keine eigenständigen Programme.
- Jedes Modul ist in sich abgeschlossen. Kein Modul importiert direkt aus einem anderen Modul. Gemeinsames kommt nach `shared` oder in den App-Kern.
- Das Dashboard zeigt pro Kunde nur die Module, die zu seinem Ziel passen.

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
- Der Kunde bekommt eine Einladung per Link, um sein Passwort selbst zu setzen. Ich sehe und kenne Kundenpasswörter nie.
- Die Rolle (Coach/Kunde) wird nur serverseitig gesetzt. Ein Kunde kann seine Rolle nie selbst ändern, auch nicht über die API.
- Mein Coach-Konto wird manuell in Supabase angelegt und ist mit Zwei-Faktor-Authentifizierung geschützt.
- Kunden können ihr Konto nicht selbst löschen, aber Löschung und Export laufen über mich auf Anfrage.

## Arbeitsweise

- Bei jeder größeren Aufgabe zuerst einen Plan zeigen und auf mein OK warten.
- Immer nur eine Aufgabe pro Session, klein halten. Danach committen.
- Nichts löschen oder verschieben, ohne vorher aufzulisten, was betroffen ist.
- Bestehende Funktionen nicht ungefragt umschreiben. Nur ändern, was zur Aufgabe gehört.
- Wenn etwas unklar ist, nachfragen statt raten.
- Neue Abhängigkeiten nur nach Rückfrage.
- Nach Änderungen kurz sagen, was geprüft wurde und was nicht.
- Mobile first: Kunden nutzen die App fast nur am Handy.

## Befehle

TODO: eintragen, sobald das Setup steht.

- Dev-Server: `npm run dev` (in `apps/app` bzw. `apps/landing`)
- Build: `npm run build`
- Tests: `npm test`

## Status

- [x] Ordnerstruktur und Git-Repo angelegt
- [ ] Landingpage nach `apps/landing` umgezogen, Netlify umgestellt
- [ ] App-Grundgerüst mit Supabase-Login und Rollen (Sign-ups aus)
- [ ] Coach-Dashboard: Kunden anlegen und einladen
- [ ] Modul Bulk Cockpit eingehängt
- [ ] Modul KM Pacer eingehängt
- [ ] Kundenprofil mit Ziel und zielabhängiges Dashboard
- [ ] Pilot mit 2-3 Kunden

Beim Abschluss eines Schritts hier abhaken.
