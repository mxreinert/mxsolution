# Bulk Cockpit

Steuerungs- und Auswertungsschicht für einen Aufbaublock vom 5.9.2026 bis 28.2.2027.
Training kommt aus Hevy, Ernährung aus Yazio. Diese App protokolliert nicht — sie entscheidet.

## Was drin ist

| Datei | Zweck |
|---|---|
| `public/index.html` | Die gesamte App. Ein File, kein Build-Schritt. |
| `netlify/functions/login.mjs` | Anmeldung, gibt ein signiertes Sitzungstoken aus |
| `netlify/functions/data.mjs` | Liest und schreibt Zustand und Fotos in Netlify Blobs |
| `netlify/functions/hevy.mjs` | Holt Workouts aus Hevy, normalisiert sie |
| `netlify/functions/analyze.mjs` | Schickt Kennzahlen an Claude, Systemprompt liegt hier |
| `netlify/functions/edit.mjs` | Änderungsassistent: übersetzt einen Freitext-Wunsch in eine whitelisted Liste von Datenänderungen |
| `netlify/functions/remind-morning.mjs` | Scheduled Function, morgens: Push-Erinnerung nur wenn heute noch kein Gewicht erfasst ist |
| `netlify/functions/remind-evening.mjs` | Scheduled Function, abends: Push-Erinnerung nur wenn heute keine Kalorien erfasst sind oder das Wochen-Review überfällig ist |
| `netlify/functions/_lib.mjs` | Auth, HMAC-Token, Blob-Zugriff, Zähler, Web-Push-Versand |
| `public/sw.js` | Service Worker, zeigt eingehende Push-Erinnerungen als Browser-Benachrichtigung |

## Einrichtung

**1. Repository anlegen und pushen**

```bash
git init && git add -A && git commit -m "Bulk Cockpit"
```

Auf GitHub pushen, dann in Netlify unter *Add new site → Import an existing project* verbinden.
Build command bleibt leer, Publish directory ist `public`.

**2. Umgebungsvariablen setzen**

Netlify → Site configuration → Environment variables:

| Variable | Wert |
|---|---|
| `APP_PASSPHRASE` | Deine Passphrase. Vier zufällige Wörter, keine Geburtstage. |
| `SESSION_SECRET` | Langer Zufallsstring, siehe unten |
| `HEVY_API_KEY` | Aus hevy.com/settings?developer — setzt Hevy Pro voraus |
| `ANTHROPIC_API_KEY` | Aus console.anthropic.com |
| `VAPID_PUBLIC_KEY` | Für Push-Erinnerungen (optional), siehe unten |
| `VAPID_PRIVATE_KEY` | Dito, geheim halten |

Session-Secret erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**3. Guthaben aufladen**

In der Anthropic Console unter Billing. Die API hat kein Abo — du zahlst pro Token.
Ein Auswertungslauf sendet etwa 2,5 KB Kennzahlen, das sind rund drei Cent mit Sonnet.
Die Function begrenzt auf 25 Auswertungen pro Tag.

**4. Deployen und aufs Handy legen**

Site öffnen, anmelden, dann im Browser *Zum Home-Bildschirm hinzufügen*. Läuft danach
als eigenständige App im Vollbild.

## Sicherheit — was geschützt ist und was nicht

**Geschützt:** Kein API-Key liegt im Frontend. Hevy- und Anthropic-Key existieren nur als
Umgebungsvariablen auf dem Server. Sitzungstoken sind HMAC-signiert und laufen nach 60 Tagen ab,
gefälschte Token werden abgewiesen. Login ist auf 15 Versuche pro Stunde begrenzt, mit
Verzögerung pro Versuch. Alle Daten-Endpunkte verlangen ein gültiges Token. Der Systemprompt
liegt serverseitig, die App lässt sich nicht als allgemeiner Chatbot missbrauchen.
Content-Security-Policy und HSTS sind gesetzt.

**Nicht geschützt:** Ein Einzelnutzersystem mit einer Passphrase. Wer die Passphrase kennt,
ist drin. Kein zweiter Faktor. Die Daten liegen unverschlüsselt in Netlify Blobs — Netlify
könnte sie technisch lesen. Für Trainingsdaten und Fotos von dir selbst ist das vertretbar;
für Kundendaten Dritter wäre es das nicht.

**Wenn du es später für Kunden öffnest:** Dann brauchst du echte Benutzerkonten, Trennung der
Daten pro Nutzer und eine Einwilligung nach DSGVO. Das ist der Punkt, an dem Supabase mit
Row Level Security ins Spiel kommt — nicht vorher.

## Hevy-Abgleich

Der Abgleich holt beim ersten Mal alles ab dem 5.9.2026, danach jeweils die letzten 30 Tage.
Bereits vorhandene Einheiten werden über die Hevy-ID überschrieben statt doppelt angelegt,
Aufwärmsätze werden ausgefiltert.

Übungsnamen werden über Stichwortregeln einer Muskelgruppe zugeordnet. Was nicht erkannt wird,
erscheint unter *Training* zur einmaligen Zuordnung — es verschwindet nicht stillschweigend
aus der Volumenrechnung.

Falls Hevy die Feldnamen der API ändert, ist `normalize()` in `hevy.mjs` die einzige Stelle,
die angepasst werden muss. Die Referenz steht unter api.hevyapp.com/docs.

## Push-Erinnerungen (optional)

Zwei Scheduled Functions, jede schickt nur, wenn wirklich etwas fehlt — kein Ping nur zum Pingen:

- `remind-morning.mjs`, 05:00 UTC (7:00 CEST / 6:00 CET): Gewicht heute noch nicht erfasst.
- `remind-evening.mjs`, 19:00 UTC (21:00 CEST / 20:00 CET): Kalorien heute noch nicht erfasst,
  oder Wochen-Review seit über 9 Tagen überfällig.

Die Uhrzeiten sind in UTC fest im `schedule`-Feld der jeweiligen Datei hinterlegt und verschieben
sich bei der Zeitumstellung um eine Stunde — bei Bedarf dort direkt anpassen.

Läuft über den nativen Web-Push-Standard der Browser (VAPID) — kein Drittanbieter-Account,
keine Kosten. Funktioniert, sobald die Seite einmal geöffnet und die Erlaubnis erteilt wurde;
auf dem Handy am zuverlässigsten, wenn die App vorher zum Home-Bildschirm hinzugefügt wurde.

**Einrichtung:**

1. VAPID-Schlüsselpaar erzeugen:
   ```bash
   node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k.publicKey);console.log(k.privateKey)"
   ```
2. Den öffentlichen Schlüssel in `public/index.html` bei der Konstante `VAPID_PUBLIC` eintragen.
3. Beide Schlüssel zusätzlich in Netlify als `VAPID_PUBLIC_KEY` und `VAPID_PRIVATE_KEY` setzen.
4. Deployen, App öffnen, unter *Review → Erinnerungen* auf "Erinnerungen aktivieren" tippen und
   die Browser-Erlaubnis bestätigen.

Ohne diese Variablen bleiben die beiden Functions bei ihrem täglichen Lauf einfach wirkungslos,
der Rest der App läuft unverändert weiter. Ein abgelaufenes oder widerrufenes Abo wird beim
nächsten Lauf automatisch erkannt und gelöscht, statt die Function dauerhaft fehlschlagen zu lassen.

## Die eingebauten Regeln

Diese Werte stehen in `index.html` im Objekt `BLOCK` und in `VOL`:

- Zunahmekorridor 0,20–0,24 kg pro Woche, gemessen am gleitenden 7-Tage-Durchschnitt
- Bankdrücken 82,5 → 100 kg über 25 Wochen
- Kalorienanpassung frühestens nach 14 Tagen und nur bei mindestens 10 Wiegetagen
- Taillenbremse bei über 0,8 cm Zuwachs pro Kilo Körpergewicht
- Volumenlandmarken MEV/MAV/MRV pro Muskelgruppe, umschaltbar auf Erhaltung

Die App ist absichtlich langsam beim Nachjustieren. Ständiges Drehen an Stellschrauben
ist das, was Aufbauphasen kaputtmacht.
