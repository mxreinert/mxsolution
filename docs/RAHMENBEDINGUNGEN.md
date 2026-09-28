# Rahmenbedingungen für die Planung

Diese Datei beschreibt, was die Plattform kann und was nicht. Sie ist für die Feature-Planung gedacht (z. B. in einem externen Chat). Alles, was hier als "geht nicht" steht, bitte nicht einplanen oder vorher mit Claude Code klären.

## Das System in einem Satz

Coaching-Web-App (PWA) auf `app.mxreinert.de` plus Landingpage auf `mxreinert.de`. Login über Supabase, Hosting über Netlify, alles im kostenlosen Tarif. Kunden nutzen sie fast nur am Handy.

## Budget: 0 € laufend (außer Domain und Claude-Abo)

| Dienst | Kostenlos bis ungefähr | Was das heißt |
|---|---|---|
| Supabase Free | 500 MB Datenbank, 1 GB Dateien, 2 Projekte | Reicht für Text/Zahlen von vielen Kunden. Fotos/Videos schnell zu viel |
| Supabase Free | Projekt pausiert nach 7 Tagen ohne Nutzung | Bei täglicher Nutzung kein Problem |
| Supabase Free | Keine automatischen Backups | Regelmäßiger manueller Export nötig |
| Netlify Free | Begrenzte Deploys und Function-Aufrufe pro Monat | Updates gebündelt ausliefern, keine ständigen Server-Abfragen |

## Geht NICHT (oder nur mit Kosten)

- **Keine App im App Store / Play Store.** Kostet 99 $/Jahr (Apple) bzw. 25 $ (Google). Die App ist eine Web-App, die man zum Homescreen hinzufügt.
- **Keine E-Mails.** Kein Mailversand eingerichtet (Einladungen, Passwort-vergessen, Newsletter, Mail-Erinnerungen). Benachrichtigungen nur in der App oder als Push.
- **Keine Zahlungen in der App.** Premium wird von Max im Coach-Dashboard manuell freigeschaltet, bezahlt wird offline.
- **Keine Selbstregistrierung.** Nur Max legt Konten an.
- **Kein "Passwort vergessen" für Kunden.** Max setzt ein neues Startpasswort.
- **Kein Konto selbst löschen.** Löschung und Export laufen auf Anfrage über Max.
- **Kein Analytics/Tracking** (Google Analytics, Meta Pixel, Hotjar usw.).
- **Keine externen Einbindungen** wie Google Fonts, YouTube-Embeds, Social-Media-Widgets (Datenschutz). Videos höchstens als Link.
- **Kein zuverlässiges GPS bei ausgeschaltetem Bildschirm.** Web-Apps (vor allem auf iPhone) können im Hintergrund kaum Standort erfassen. Der KM Pacer braucht offenen Bildschirm.
- **Keine Videocalls in der App.**
- **Keine großen Datei-Uploads** (Videos, viele hochauflösende Fotos) wegen 1 GB Limit.

## Geht, aber mit Einschränkung

- **Push-Benachrichtigungen:** gehen. Auf dem iPhone nur, wenn die App zum Homescreen hinzugefügt wurde (iOS 16.4+).
- **KI-Analyse (Anthropic):** kostet pro Nutzung. Nur für Kunden, die Max freischaltet. Daten gehen dabei an Anthropic (USA), das muss der Kunde wissen und zustimmen.
- **Hevy-Anbindung:** Kunde braucht Hevy Pro und gibt seinen API-Key. Premium-Funktion, pro Kunde freischaltbar.
- **Fortschrittsfotos:** technisch möglich, aber sensibel und speicherintensiv. Nur klein/komprimiert und gut überlegt.
- **Chat zwischen Coach und Kunde:** möglich, aber einfach halten (kein WhatsApp-Ersatz).
- **Offline:** KM Pacer läuft offline. Eintragen ohne Netz ist aufwendiger und muss extra geplant werden.

## Feste Regeln (nicht verhandelbar)

- Gesundheitsdaten, auch von Minderjährigen: Bei Minderjährigen ohne Einwilligung der Eltern kein Konto.
- Ein Kunde sieht nur seine eigenen Daten. Max sieht nur die Daten seiner Kunden.
- Nur so viele Daten erfassen wie nötig. Jedes neue Datenfeld: "Brauche ich das wirklich?"
- Jede neue Datenart muss exportierbar und löschbar sein.
- Login: Benutzername + Startpasswort von Max, Kunde muss beim ersten Login ein eigenes Passwort setzen.
- Module (Bulk Cockpit, KM Pacer, später weitere) sind unabhängig voneinander. Jeder Kunde sieht nur die Module, die zu seinem Ziel passen.
- Mobile first.

## Was die Planung liefern soll

1. Kundenreise: vom ersten Kontakt bis zum laufenden Coaching, was sieht der Kunde am ersten Tag
2. Ziele (Bulk, Cut, Laufen, ...) und welches Modul zu welchem Ziel gehört
3. Coach-Dashboard: was Max pro Kunde sehen und einstellen will
4. Premium: was ist Standard, was wird freigeschaltet, wie wird der Kunde informiert
5. Pro Modul: welche Daten werden erfasst, was macht der Kunde täglich
6. Prioritäten: was braucht der Pilot mit 2-3 Kunden, was kann warten

Ergebnis als eine Markdown-Datei, abzulegen als `docs/PLAN.md`.
