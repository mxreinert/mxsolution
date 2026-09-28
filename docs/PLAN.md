# PLAN – Coaching-App mxreinert

Stand: 28.09.2026 (Version 2) · Grundlage: `RAHMENBEDINGUNGEN.md`
Ablage: `docs/PLAN.md`

---

## 0. Sinn und Zweck

**Die App ist das Zuhause des Coachings.** Alles zwischen Kunde und Max (Anamnese, Konzept, Training, Ernährung, Körper- und Gesundheitswerte, Feedback) läuft an einem Ort statt über WhatsApp, Excel und mehrere Apps.

Ziele:
1. **Alles in einem** – ein Login, ein Homescreen, alle Daten des Coachings
2. **Dranbleiben** – gutes Tracking, klare Grafiken, sichtbarer Fortschritt, Erinnerungen
3. **Verkaufsargument** – eigene App mit ordentlichem Design statt PDF-Plänen

Die Software ist nur für Max' eigenes Coaching (kein Verkauf an andere Coaches).

**Woran der Pilot gemessen wird:**
- Abend-Check an mindestens 5 von 7 Tagen ausgefüllt
- Wöchentlicher Check-in über 80 % abgegeben
- Max spart pro Kunde und Woche Zeit gegenüber vorher
- Nach Woche 1 keine Fragen mehr wie „wo trage ich das ein?"

---

## 1. Grundstruktur

```
Interessent  →  Konzept  →  Kunde (Konto)  →  Tägliches Tracking  →  Wöchentlicher Check-in  →  Konzept anpassen
   (Anamnese)    (Ziel,       (aus Interessent                          (Feedback von Max)        (alle 4–8 Wochen)
                  Module,      erzeugt)
                  Plan)
```

### 1.1 Interessent (noch kein Konto)
- Max legt im Dashboard einen Interessenten an (Name, Kontakt, Datum Erstkontakt)
- **Anamnese-Formular** mit festen Abschnitten und Pflichtfeldern, damit nichts vergessen wird:
  - Ziel und Motivation
  - Trainingserfahrung, aktuelle Aktivität, Sportarten
  - Gesundheit: Verletzungen, Einschränkungen, Freigabe Arzt nötig?
  - Alltag: Beruf/Schule, Schlaf, Stress, verfügbare Trainingstage und -zeit
  - Ernährung: aktuelle Gewohnheiten, Tracking-Erfahrung, Unverträglichkeiten
  - Ausrüstung/Studio
  - Minderjährig: Elterneinwilligung liegt vor (ja/nein, Datum)
  - **Notfallkontakt:** Name, Beziehung, Telefon + Hinweise für den Notfall (z. B. Asthma-Spray). Wird bei Übernahme ins Kundenprofil übernommen und ist im PT-Termin mit einem Tipp erreichbar
- Status: **offen · Konzept · übernommen · verworfen**
- **Verwerfen = Daten löschen:** automatisch **45 Tage** nach dem Verwerfen, vorher manuell möglich. Das Dashboard zeigt „wird gelöscht am …". Es sind Gesundheitsdaten ohne Vertrag.
- Wird ein verworfener Interessent innerhalb der 45 Tage wieder aktiv, kann er zurückgeholt werden.

### 1.2 Konzept zur Zielerreichung
Pro Interessent/Kunde im Dashboard:
- Hauptziel (siehe Abschnitt 2), Zeitraum, Etappenziele
- Zielwerte: Körpergewicht/Wochenveränderung, kcal + Makros, Schritte, Schlafdauer, Cardio-Umfang
- Trainingsplan (aus Vorlage oder neu)
- Aktive Module (Ziel schlägt vor, Max passt an)
- Freischaltungen (Premium)
- Erinnerungen (Standard-Set, Kunde kann Zeiten ändern)

### 1.3 Übernahme als Kunde
- Ein Klick „Als Kunde übernehmen": Konto wird erzeugt, Anamnese und Konzept wandern mit
- Benutzername + Startpasswort, Übergabe persönlich
- Kurzanleitung „Zum Homescreen hinzufügen" (iPhone/Android getrennt, mit Bildern)

### 1.4 Erster Tag für den Kunden
1. Login → eigenes Passwort setzen
2. Datenschutz-Hinweis in einfacher Sprache, bestätigen
3. Onboarding, max. 3 Bildschirme: „Dein Ziel", „Deine Module", „So funktioniert der Abend-Check"
4. Push erlauben (Erklärung wofür; iPhone nur nach Homescreen-Installation)
5. Startwerte eintragen
6. Ab jetzt: Heute-Screen

### 1.5 Laufend und Ende
- **Täglich:** Training nach Plan, abends Abend-Check
- **Wöchentlich:** Check-in, Max gibt Feedback
- **Alle 4–8 Wochen:** Konzept überarbeiten, Kunde bekommt Hinweis
- **Ende:** Export auf Wunsch, Konto deaktivieren, nach vereinbarter Frist löschen

---

## 2. Ziele und Module

**Module = Datenbereiche. Ziele = Voreinstellung, welche Module aktiv sind.** Jedes Modul kann bei jedem Kunden an/aus sein, unabhängig vom Ziel.

### 2.1 Module

| # | Modul | Kurz |
|---|---|---|
| M1 | **Krafttraining** | Pläne, Log, Progression, Auswertung |
| M2 | **Cardio** | Laufen, Rad, Schwimmen usw., inkl. KM Pacer |
| M3 | **Ernährung** | kcal + Makros täglich (aus Yazio o. ä. abgeschrieben) |
| M4 | **Körpergewicht** | täglich, Trend |
| M5 | **Aktivität** | Schritte + verbrannte kcal (von Uhr/Handy abgelesen) |
| M6 | **Schlaf** | Dauer + Qualität (von Uhr oder selbst geschätzt) |
| M7 | **Motivation & Befinden** | täglich kurze Skala |
| M8 | **Gesundheitswerte Uhr** | optional: Ruhepuls, ggf. HRV |
| M9 | **Hevy-Anbindung** | freischaltbar |
| M10 | **KI-Analyse** | freischaltbar |
| M11 | **Fortschrittsfotos / Umfänge** | freischaltbar |
| M12 | **Personal Training** | Termine, Kalender, Orte, Live-Logging, PT-Kontostand |
| M13 | **Kreatin** | Einnahme täglich, erklärt Gewichtssprünge |
| M14 | **Zyklus** | Periodenbeginn, erklärt Gewichtsschwankungen (nur mit Einwilligung) |
| M15 | **Eltern-Bericht** | exportierbarer Bericht für Eltern Minderjähriger, kein Eltern-Login |

Querschnitt (kein Datenmodul, immer da): **Heute-Screen, Abend-Check, Wöchentlicher Check-in, Erinnerungen & Benachrichtigungen, Auswertung.**

**Wichtig:** Die App liest keine Daten von Apple Watch, Garmin, Yazio usw. automatisch aus (Web-Apps haben keinen Zugriff auf Apple Health). **Der Kunde trägt alles selbst ein**, typischerweise abends. Das muss beim Onboarding klar gesagt werden.

### 2.2 Ziel-Voreinstellungen

| Modul | Muskelaufbau (Bulk) | Fettabbau (Cut) | Laufen/Ausdauer | Allgemeine Fitness | Recomp/Halten |
|---|:-:|:-:|:-:|:-:|:-:|
| M1 Krafttraining | ✅ | ✅ | optional | ✅ | ✅ |
| M2 Cardio | optional | ✅ | ✅ | ✅ | optional |
| M3 Ernährung | ✅ | ✅ | optional | optional | ✅ |
| M4 Körpergewicht | ✅ | ✅ | optional | optional | ✅ |
| M5 Aktivität | optional | ✅ | ✅ | ✅ | ✅ |
| M6 Schlaf | ✅ | ✅ | ✅ | ✅ | ✅ |
| M7 Motivation | ✅ | ✅ | ✅ | ✅ | ✅ |
| M8 Uhr-Werte | – | – | optional | – | – |

Das Ziel bestimmt außerdem, **wie ausgewertet wird**: Beim Bulk ist eine Gewichtszunahme im Zielbereich grün, beim Cut eine Abnahme. Gleiches Modul, andere Bewertung.

Neue Ziele (z. B. Reha-Aufbau nach Verletzung, Wettkampfvorbereitung) werden nur als neue Voreinstellung angelegt, ohne neue Module.

---

## 3. Kunden-App

Mobile first. Untere Navigation mit 4–5 Punkten:

1. **Heute** – anstehendes Training, offener Abend-Check, Feedback von Max, Erinnerungen
2. **Training** – Plan der Woche, Krafttraining starten, Cardio eintragen/KM Pacer
3. **Eintragen** – Abend-Check (und einzelne Werte jederzeit nachtragbar)
4. **Auswertung** – Grafiken pro Modul und Gesamtübersicht
5. **Profil** – Profilbild, Ziel, Konzept-Übersicht, Geräte, Benachrichtigungen/Mute, Hilfe & FAQ, Datenschutz, Abmelden

**Profil im Detail:**
- **Profilbild:** Kunde lädt selbst hoch, wird auf ca. 256 × 256 px zugeschnitten und stark komprimiert (unter 50 KB). Erscheint auch im Dashboard von Max. Kunde kann es jederzeit ändern oder löschen.
- **Geräte:** beim ersten Login einmal angeben, welche Uhr/App genutzt wird (Apple Watch, Garmin, Fitbit, Handy, keine; Ernährungs-App: Yazio, MyFitnessPal, …). Bei Wechsel hier ändern.
- **Sitzung:** eingeloggt bleiben für 7 Tage, dann neu anmelden. Abmelden-Button in den Einstellungen.
- **Hilfe & FAQ:** Homescreen hinzufügen, Push aktivieren, Abend-Check, „Warum schwankt mein Gewicht?", „Was ist RIR?", Kontakt über WhatsApp.

**Für Max:** Zwei-Faktor-Login für das Dashboard per Authenticator-App (TOTP). Soweit ich weiß im Supabase-Free-Tarif enthalten (SMS-Codes nicht) – vor dem Einbau kurz prüfen.

### 3.1 Abend-Check (das wichtigste Element)
Eine Seite, nur aktive Module, Ziel: **unter 2 Minuten**.

| Feld | Modul | Eingabe |
|---|---|---|
| Körpergewicht (falls morgens nicht eingetragen) | M4 | Zahl |
| kcal, Protein, Kohlenhydrate, Fett | M3 | 4 Zahlen |
| Schritte | M5 | Zahl |
| Verbrannte kcal (aktiv) | M5 | Zahl |
| Schlaf letzte Nacht: Dauer + Qualität 1–5 | M6 | Zahl + Tippen |
| Motivation 1–5, Energie 1–5 | M7 | Tippen |
| Ruhepuls | M8 | Zahl |
| Notiz zum Tag (optional) | – | kurzer Text |

- **Tag = 00:00 bis 23:59 Uhr Ortszeit**
- **Datum wählbar:** heute oder bis zu **3 Tage rückwirkend**. Ältere Tage nur durch Max.
- **Korrigieren:** Kunde kann eigene Einträge bis 3 Tage danach ändern, danach nur Max (Kunde meldet sich per WhatsApp)
- **Erinnerung:** Fehlt ein Tag länger als 24 h, kommt der Hinweis „Gestern fehlt noch – bitte zeitnah eintragen"
- Button **„Nicht getrackt"** pro Feld (z. B. Ernährung), damit Max „vergessen" und „bewusst nicht" unterscheiden kann
- Werte vom Vortag als Platzhalter, um Tippfehler zu erkennen
- Plausibilitätsprüfung (Warnung, kein Verbot), z. B. Gewicht ±3 kg zum Vortag, kcal < 800 oder > 6.000, Schritte > 50.000, Schlaf > 14 h
- Leere Felder sind erlaubt, lieber unvollständig als gar nicht
- Durchschnitte nur aus vorhandenen Tagen mit Hinweis „aus 5 von 7 Tagen – bitte vollständiger eintragen". Lücken in Grafiken nie als 0.
- Einheiten fest: kg, km, kcal, Stunden
- Gewicht zusätzlich morgens einzeln eintragbar (nüchtern ist genauer)

### 3.2 Wöchentlicher Check-in
Tag von Max pro Kunde festgelegt. Wenige Fragen, antippbar:
- Wie lief die Woche? (1–5 + optional Text)
- Hunger, Stress, Regeneration (1–5)
- Was war schwierig? (optional Text)
- Automatische Wochenzusammenfassung aus den Modulen wird angehängt
- Feedback von Max erscheint im Heute-Screen

---

## 4. Module im Detail

Bei jedem Datenfeld gilt: *Brauche ich das wirklich?* Jedes Modul ist exportierbar und löschbar.

### M1 Krafttraining
**Planung (Max):**
- Plan-Vorlagen (z. B. PPL, Ganzkörper, OK/UK), einem oder mehreren Kunden zuweisen
- Pro Übung: Sätze, Wdh.-Bereich, Ziel-RIR, Pausenzeit, Hinweis/Videolink
- Blöcke/Mesozyklen mit Deload-Woche

**Log (Kunde):**
- Heute-Screen zeigt die geplante Session. **„Andere Session"** startet stattdessen eine andere Einheit aus dem Plan (= Training verschieben)
- **Freies Training** außerhalb des Plans (inkl. Anstrengung 1–10): nur sichtbar, wenn Max es für den Kunden freigibt
- Satzarten: Aufwärmsätze (zählen nicht ins Volumen), Supersätze, Drop-Sets, einseitig (links/rechts), Zeitübungen, Körpergewicht + Zusatzgewicht, Assistenz
- **Schmerzen/Beschwerden** pro Training eintragbar (ja/nein + Körperstelle), sofortige Benachrichtigung an Max
- Pro Satz: Gewicht, Wdh., optional RIR
- „Letztes Mal"-Anzeige beim Eintragen
- Progressionshinweis bei doppelter Progression (obere Grenze in allen Sätzen erreicht)
- Pausentimer (offline)
- PR-Erkennung

**Auswertung:**
- Leistungsverlauf pro Übung: geschätztes 1RM (feste Formel, z. B. Epley, nur bis 10 Wdh.). **Trägt der Kunde ein getestetes 1RM ein, wird dieses angezeigt** und als „getestet" markiert
- Planwechsel: alles bleibt gespeichert, Pläne sind versioniert, Übungsverläufe laufen planübergreifend weiter
- Wochenvolumen pro Muskelgruppe (Sätze), für Max mit MEV/MAV-Orientierung
- Trainingsfrequenz, Planerfüllung in %

### M2 Cardio
- Pro Einheit: Datum, Art (Laufen, Rad, Schwimmen, Rudern, sonstiges), Dauer, Distanz (falls sinnvoll), Intensität (locker/Tempo/Intervall/lang), Anstrengung 1–10, optional Ø-Puls
- **KM Pacer** ist Teil des Moduls: gleicher Login, Ergebnis mit einem Tipp übernehmen. Läuft offline, braucht offenen Bildschirm. Keine GPS-Spur speichern, nur Distanz, Zeit, Splits.
- Plan von Max: Einheiten der Woche mit Vorgabe
- Auswertung: Minuten/Km pro Woche, Pace-Entwicklung, Verteilung locker vs. intensiv

### M3 Ernährung
- Täglich kcal, Protein, KH, Fett (abgeschrieben aus Yazio/MyFitnessPal)
- Zielwerte von Max, optional unterschiedlich für Trainings- und Ruhetage
- Auswertung: Wochendurchschnitt vs. Ziel, Protein-Trefferquote, Verlauf
- Bewusst **keine** eigene Lebensmitteldatenbank (riesiger Aufwand, Yazio kann das besser)

### M4 Körpergewicht
- Täglich, bevorzugt morgens nüchtern
- Anzeige: 7-Tage-Schnitt groß, Einzelwerte klein
- Wochenveränderung vs. Zielbereich (Bewertung je nach Ziel)

### M5 Aktivität
- Schritte und aktiv verbrannte kcal, abends abgelesen
- Ziel-Schritte von Max
- Auswertung: Wochenschnitt, Zielerreichung

### M6 Schlaf
- Dauer (Stunden, eine Nachkommastelle) + Qualität 1–5
- Quelle egal (Uhr oder Schätzung)
- Auswertung: Schnitt, Verlauf, Vergleich mit Training/Motivation (siehe Abschnitt 6)

### M7 Motivation & Befinden
- Motivation 1–5, Energie 1–5 täglich
- Auswertung: Verlauf, Frühwarnung für Max bei mehreren niedrigen Tagen in Folge

### M8 Gesundheitswerte Uhr (optional)
- Ruhepuls, ggf. HRV
- Nur aktivieren, wenn Max die Werte wirklich fürs Coaching nutzt (z. B. Ausdauertraining, Übertraining erkennen)

### M9 Hevy-Anbindung (freischaltbar)
- Für Kunden mit Hevy Pro, die nicht wechseln wollen
- Liest Trainings aus Hevy, zeigt sie in M1-Auswertung und Dashboard
- API-Key verschlüsselt speichern, Kunde kann ihn entfernen
- Abfrage beim Öffnen oder 1× täglich (Netlify-Limits)
- Bei aktivem Hevy wird der eigene Logger ausgeblendet (kein Doppel-Eintragen)

### M10 KI-Analyse (freischaltbar)
- Trend-Zusammenfassung über alle Module auf Knopfdruck (Kosten)
- Nur Zahlen senden, kein Name/Benutzername
- Einwilligung des Kunden in der App (bei Minderjährigen: Elterneinwilligung muss die Übertragung in die USA ausdrücklich abdecken)
- Empfehlung: zuerst nur im Dashboard für Max, der die Analyse prüft und in eigenen Worten weitergibt

### M11 Fortschrittsfotos / Umfänge (freischaltbar)
- Umfänge (Taille, Brust, Arm, Oberschenkel …) alle 1–4 Wochen
- Fotos stark komprimiert (~200 KB), 1 Set alle 4 Wochen, nur Kunde + Max sehen sie
- Kunde kann eigene Fotos selbst löschen
- Speicher: 1 GB reicht nur mit Komprimierung für viele Kunden

### M12 Personal Training (freischaltbar)
**Kalender (Max):**
- Termine anlegen: Kunde(n), Datum, Uhrzeit, Dauer, Ort, Art (Kraft, Cardio, Technik, Test), Notiz („Laufschuhe mitbringen")
- Wiederkehrende Termine (z. B. jeden Dienstag 18 Uhr)
- **Google Calendar:** Termine werden in Max' Google-Kalender übertragen (kostenlos über die Google Calendar API). Achtung bei der Einrichtung: Die Google-App muss auf „In Produktion" stehen, im Testmodus laufen die Zugangstokens nach 7 Tagen ab und die Verbindung bricht ständig. Nur Max' Kalender wird verbunden, Kunden bekommen „Zum Kalender hinzufügen" (.ics)
- Mehrere Kunden pro Termin möglich (Partner- oder Kleingruppentraining)
- Ansichten: Tag, Woche, Liste; Konflikt-Warnung bei Überschneidung
- Status: geplant · bestätigt · abgesagt (von Kunde/Max) · verschoben · durchgeführt · nicht erschienen
- **PT-Kontostand** (Bezahlung bleibt offline, die App zählt nur):
  - Kunde zahlt → Max bucht **+1** (oder +10 bei einem Block)
  - Termin durchgeführt → automatisch **−1**
  - Jede Buchung mit Datum, Grund und Notiz als Verlauf, nicht nur eine Zahl. So ist später nachvollziehbar, warum der Stand so ist
  - Stand kann negativ werden (Termin vor Zahlung), dann rote Anzeige für Max
  - Kunde sieht seinen Stand („Guthaben: 3 PT")
  - Hinweis an Max bei 1 verbleibender Einheit

**Orte:**
- Gespeicherte Orte (Name, Adresse, Hinweis wie „Eingang hinten, Parkplatz rechts")
- **Karten-Link je nach Gerät:** iPhone → Apple Maps, Android → Google Maps, zusätzlich „In anderer Karten-App öffnen". Nur Link, keine eingebettete Karte (Regel: keine externen Einbindungen)

**Kunde sieht:**
- Nächster Termin im Heute-Screen mit Ort, Uhrzeit, Karten-Button, Mitbringliste
- „Zum Kalender hinzufügen" (.ics-Datei, funktioniert mit Apple-, Google- und Outlook-Kalender)
- Termin bestätigen oder absagen (mit Absagefrist aus dem Vertrag, z. B. 24 h; spätere Absage wird als „kurzfristig" markiert)

**Erinnerungen:**
- 2 Tage vorher: „In 2 Tagen Personal Training, Di 18:00, [Ort], [Adresse]" + Karten-Button
- Am Tag, 2 h vorher (Zeitpunkt einstellbar)
- Bei Änderung/Absage sofort an die andere Seite

**Live-Logging durch Max:**
- Max öffnet den Termin am Handy → Trainingslog des Kunden im Coach-Modus (gleicher Logger wie M1)
- Einträge landen direkt in der Trainingshistorie des Kunden, markiert als „mit Max"
- **Muss offline funktionieren** (Studio-Keller, schlechtes Netz): lokal speichern, später synchronisieren, sichtbare Anzeige „noch nicht synchronisiert"
- Nach dem Termin: kurze Notiz von Max (Technik, Befinden, nächstes Mal), Kunde sieht sie optional

### M13 Kreatin
- Täglich im Abend-Check: genommen ja/nein, Menge in g
- Beginn der Einnahme wird in der Gewichtsgrafik markiert
- Auswertung weiß: In den ersten 1–3 Wochen nach Beginn ist eine Zunahme von ca. 1–2 kg Wasser normal → wird beim Gewichtstrend als Hinweis angezeigt, damit Bulk/Cut nicht falsch bewertet werden

### M14 Zyklus
- **Nur mit ausdrücklicher Einwilligung der Kundin** (bei Minderjährigen auch der Eltern), Max aktiviert erst danach
- Erfasst wird **nur der Periodenbeginn** (Datum). Keine Symptome, keine weiteren Angaben
- Gewichtsgrafik zeigt Zyklusphasen als leichte Hinterlegung, damit typische Schwankungen erklärbar sind
- Kundin kann das Modul jederzeit selbst abschalten und alle Einträge löschen

### M15 Eltern-Bericht
- Kein eigener Login für Eltern
- Max erzeugt im Dashboard einen Bericht (z. B. monatlich) mit ausgewählten Bereichen: Training, Fortschritt, Termine
- Max wählt pro Bericht, was drin ist, und gibt ihn selbst weiter

---

## 4b. Kundenstatus: Aktiv, Erhaltung, Pause

Jeder Kunde hat genau einen Status. Er bestimmt Erinnerungen, Zielwerte, Auswertung und Ampel.

| Status | Wann | Was passiert in der App |
|---|---|---|
| **Aktiv** | normales Coaching | alles läuft nach Konzept |
| **Erhaltung** | Ziel erreicht, Stressphase, Prüfungen, zwischen Bulk und Cut | Zielwerte auf Erhaltung (kcal, Gewicht „halten" = grün), Trainingsplan Erhaltungsvolumen, weniger Erinnerungen |
| **Reduziert** | kurze Belastungsspitze, Deload, leichte Erkältung | Plan mit weniger Volumen/Intensität, Tracking läuft weiter |
| **Pause – Krankheit/Verletzung** | krank, verletzt | alle Erinnerungen aus außer 1× „Gute Besserung / melde dich, wenn es wieder geht", keine Ampel rot, Serien brechen nicht |
| **Pause – Urlaub/sonstiges** | Urlaub, Umzug, private Gründe | wie oben, optional Gewicht weiter eintragen |
| **Beendet** | Coaching vorbei | Lesezugriff bis Löschung, Export anbieten |

**Ablauf Krankheit:**
1. Kunde meldet sich im Heute-Screen oder im Check-in ab: „Ich kann gerade nicht trainieren"
   - Grund (Auswahl): **Krankheit · Unfall · Verletzung · Psychische Belastung · Sonstiges**
   - Bei Verletzung/Unfall genauer (Auswahl): Muskel (Zerrung/Faserriss), Gelenk/Bänder, Knochen (Bruch), Sehne, Rücken, Sonstiges + Körperstelle
   - Bei Krankheit: Erkältung/Infekt, Magen-Darm, Fieber, Sonstiges
   - Bei psychischer Belastung: **keine weitere Abfrage**, stattdessen Hinweis „Max meldet sich bei dir" und ein Link zu Hilfsangeboten (in Luxemburg z. B. SOS Détresse 454545 – vor Einbau Nummer prüfen)
   - Optional: voraussichtlich bis …, kurze Notiz
   - Alle Angaben exportier- und löschbar, nur Kunde und Max sehen sie
2. Erinnerungen werden sofort stumm, Max bekommt eine Benachrichtigung.
3. Max bestätigt den Status oder meldet sich.
4. Während der Pause: Termine (M12) werden als „abgesagt – Krankheit" markiert, nicht als kurzfristige Absage.
5. **Rückkehr:** Kunde tippt „Wieder fit" → Max wählt einen Wiedereinstiegsplan (z. B. Woche 1 mit ca. 60 % Volumen) oder schaltet direkt auf Aktiv.
6. In allen Grafiken erscheint die Pause als graues Band, damit Einbrüche erklärbar sind.
7. Automatische Rückfrage an Max, wenn der Status länger als 14 Tage Pause ist.

Wer darf den Status ändern? Kunde kann nur **Pause melden** und **Rückkehr melden**. Alle anderen Wechsel (Erhaltung, Reduziert, Beendet) macht Max.

**Weitere Abläufe:**
- **Erhaltung:** Max schaltet um → Zielwerte, Plan, Bewertung und Erinnerungen stellen sich automatisch auf Erhaltung. Wird auch für Prüfungs- und Stressphasen genutzt.
- **Zielwechsel:** grundsätzlich erst ein Ziel abschließen. Wenn doch nötig: Max schaltet das Ziel im Dashboard um, alte Phase bleibt gespeichert und in den Grafiken sichtbar.
- **Pause auf Kundenwunsch:** Coaching wird pausiert, sonst wie Pause-Status.
- **Kündigung/Ende:** Max trägt das Ende im Dashboard ein → Export wird erzeugt → Max schickt ihn dem Kunden → Login wird deaktiviert.
- **Wiedereinstieg:** Max importiert den früheren Export wieder. Dafür muss das Exportformat von Anfang an **wieder einlesbar und versioniert** sein (nicht nur eine CSV zum Anschauen).
- **Kunde wird 18:** in der App passiert nichts, Max regelt das außerhalb.

---

## 5. Erinnerungen & Benachrichtigungen

**Zwei Arten:**
1. **In-App-Pop-ups** beim Öffnen (kostenlos, immer verfügbar): „Abend-Check fehlt", „Neues Feedback", „Neuer Plan", „Neu freigeschaltet"
2. **Push-Benachrichtigungen** (auf iPhone nur nach Homescreen-Installation, iOS 16.4+)

**Standard-Erinnerungen** (Kunde stellt Uhrzeit selbst ein, kann einzelne abschalten):
- Morgens: Gewicht wiegen
- Abends: Abend-Check
- Trainingstag: „Heute steht … an"
- Check-in-Tag: Check-in abgeben
- Max kann manuell eine Nachricht an einen Kunden pushen (z. B. Motivation, Hinweis)

**Technik/Limit:** Push wird serverseitig verschickt (geplante Netlify Function). Daher feste Zeitfenster (z. B. alle 30 Min prüfen) statt minutengenau, damit die Function-Aufrufe im Free-Tier bleiben. Keine Erinnerung, wenn der Eintrag schon erledigt ist.

**Einstellungen für den Kunden:** Liste aller Erinnerungen, je an/aus + Uhrzeit, „Ruhezeit" (z. B. 22–7 Uhr keine Push).

**Mute-Modus:** Kunde schaltet in den Einstellungen stumm (dauerhaft oder für einen Zeitraum). Danach, oder morgens nach der Ruhezeit, kommt **eine** Übersicht „Das ist neu" – **nur wenn wirklich etwas neu ist** (Feedback, neuer Plan, Terminänderung). Sonst nichts.

**Push geht nicht** (iPhone nicht zum Homescreen hinzugefügt, iOS zu alt, abgelehnt): App erkennt das und zeigt im Profil „Push ist aus – so aktivierst du es". Fallback: In-App-Pop-ups beim Öffnen.

---

## 5b. Kommunikation

- **WhatsApp bleibt der Hauptkanal** für persönliche Kommunikation, Absprachen, Updates und Probleme. Die App ersetzt WhatsApp nicht und bekommt keinen eigenen Chat.
- Überall, wo der Kunde Max braucht, gibt es einen Button **„Max auf WhatsApp schreiben"** (Link `wa.me/…`, keine Einbindung): Login-Bildschirm (Passwort vergessen), Profil, Krankmeldung, Korrektur alter Einträge, PT-Termin.
- Die App ist für strukturierte Sachen zuständig: Check-in, Feedback, Pläne, Termine, Erinnerungen.
- **App-Updates** werden nachts ausgeliefert, Kunden werden per WhatsApp über Neuerungen informiert.

---

## 6. Grafiken und Auswertungen

Ordentliche Grafiken sind ein Hauptverkaufsargument, deshalb einheitlich gebaut:

- **Eine gemeinsame Diagramm-Komponente** für alle Module (gleiches Aussehen, gleiche Bedienung). Bibliothek lokal eingebunden, nicht über CDN (Regel: keine externen Einbindungen)
- **Zeiträume umschaltbar:** 7 Tage · 4 Wochen · 3 Monate · alles
- **Immer Trend statt Rauschen:** gleitender Schnitt bei Gewicht, Schritten, kcal
- **Zielbereich im Diagramm** als Band (grün = im Ziel)
- **Pro Modul eine Kennzahl-Karte** oben: aktueller Wert, Veränderung, Ziel
- **Wochenbericht** (automatisch): alle Module auf einer Seite, auch als Grundlage für den Check-in
- **Zusammenhänge** (später): z. B. Schlaf vs. Trainingsleistung, kcal vs. Gewichtstrend. Ehrlich: Bei wenigen Wochen Daten sind solche Vergleiche oft Zufall. Erst ab ca. 8 Wochen Daten anzeigen und als „Hinweis", nicht als Beweis formulieren.

Das Dashboard nutzt dieselben Grafiken, nur mit mehr Details.

---

## 7. Coach-Dashboard

### Bereiche
1. **Interessenten** – Liste mit Status, Anamnese, Konzept, „übernehmen/verwerfen"
2. **Kunden** – Übersicht mit Ampel
3. **Pläne & Vorlagen** – Trainingspläne, Anamnese-Vorlage, Konzept-Vorlagen pro Ziel
4. **Check-ins** – offene Check-ins, die auf Feedback warten
5. **Daten** – Export pro Kunde, Gesamt-Backup, Löschungen

### Kundenübersicht
- Ampel: grün = trägt regelmäßig ein, gelb = 2–3 Tage nichts, rot = Check-in verpasst oder Motivation mehrere Tage niedrig
- Kennzeichnung „minderjährig · Elterneinwilligung vom …" (nur als Vermerk, keine Sperren)

### Pro Kunde
- **Einstellen:** Ziel, Module, Zielwerte, Trainingsplan, Freischaltungen, Erinnerungs-Standard, Check-in-Tag, Passwort zurücksetzen, deaktivieren, löschen
- **Sehen:** Anamnese, Konzept, alle Modul-Auswertungen, Wochenberichte, Check-in-Verlauf, Eintrags-Regelmäßigkeit
- **Notiz** nur für Max
- **Nutzungsstatistik:** wann die App geöffnet wurde (Datum + Uhrzeit), Tage mit Einträgen, übliche Eintragszeit. Grafik „Nutzung letzte 30 Tage". Da Kunden 7 Tage eingeloggt bleiben, zählt „App geöffnet", nicht „eingeloggt". Muss im Datenschutz-Hinweis für Kunden stehen. Vorschlag: Einzelzeiten nach 90 Tagen zu Tageswerten zusammenfassen.
- **Benachrichtigung an Max**, wenn ein Kunde X Tage die App nicht geöffnet hat (X pro Kunde einstellbar, Standard 3)
- **Rechte:** Max darf alle Daten ändern und gibt Module frei. Kunde darf nur Tracking-Einträge in freigegebenen Modulen anlegen und (bis 3 Tage) ändern. Änderungen von Max werden protokolliert.

### Datenpflege
- Export pro Kunde (JSON + CSV)
- Gesamt-Backup mit Erinnerung „letztes Backup vor X Tagen" (Ziel: wöchentlich, da Supabase Free kein Backup macht)

---

## 8. Premium

- Premium wird im **Vertrag** geregelt, Bezahlung offline, Max schaltet manuell frei. Nichts in der App läuft automatisch.
- Umsetzung als **einzelne Freischaltungen pro Kunde** (M9, M10, M11, ggf. weitere). Pakete ergeben sich später aus dem Vertrag, ohne App-Umbau.
- Beim Freischalten: einmaliges Pop-up „Neu für dich freigeschaltet: …"
- Bei Abschalten: Daten bleiben sichtbar, keine neuen Einträge (Vorschlag)
- Gesperrte Funktionen nicht überall als Schloss anzeigen, höchstens eine Seite „Was es noch gibt"

---

## 9. Prioritäten

### Phase 1 – Pilot (2–3 Kunden, 4–6 Wochen)
Ziel: beweisen, dass Kunden täglich eintragen.

1. Login, Passwort beim ersten Login, Rollen Kunde/Coach, Datenzugriff nur auf eigene Daten
2. Dashboard: Interessent anlegen mit Anamnese, Konzept, als Kunde übernehmen
3. Heute-Screen + Abend-Check
4. M1 Krafttraining (neu gebaut, auf Basis der Übungsdatenbank) mit Plan-Zuweisung
5. M3 Ernährung, M4 Körpergewicht, M5 Aktivität, M6 Schlaf, M7 Motivation (alle sehr einfach, fast nur Zahlenfelder im Abend-Check)
6. Wöchentlicher Check-in mit Feedback
7. Grundgrafiken: Kennzahl-Karte + Verlauf pro Modul
8. Export + Gesamt-Backup
9. In-App-Pop-ups (Push erst Phase 2)

### Phase 2
- Kundenstatus (Aktiv, Erhaltung, Pause …) – falls ein Pilotkunde krank wird, vorher als einfacher Schalter
- M12 Personal Training mit Kalender, Orten, Erinnerungen, Offline-Logging (vorziehen, falls Pilotkunden PT haben)
- Push-Erinnerungen + Benachrichtigungs-Einstellungen
- M2 Cardio + KM Pacer eingebunden
- Wochenbericht, Zielbänder, Zeitraum-Umschaltung
- Kunden-Ampel, Plan-Vorlagen, Mesozyklen
- Freischaltungs-System

### Phase 3
- M8 Uhr-Werte, M9 Hevy, M10 KI, M11 Fotos/Umfänge
- Zusammenhangs-Analysen

### Nicht bauen (vorerst)
Store-App, Zahlungen, E-Mail, Selbstregistrierung, Videocalls, Tracking/Analytics, eigene Lebensmitteldatenbank, Chat (Check-in + Push decken das meiste ab).

---

## 10. Offene Entscheidungen für Max

Entschieden: Verworfene Interessenten werden nach 45 Tagen gelöscht.
Alle Sonderfälle und Detailfragen stehen in `docs/SONDERFAELLE.md`.

1. Anamnese-Fragen final festlegen (Pflicht vs. optional)
2. Absagefrist und Regeln für Personal Training (Vertrag)
3. Check-in-Tag: für alle gleich oder pro Kunde
4. Aufbewahrungsfrist nach Coaching-Ende (Vorschlag: 3 Monate, dann löschen, vorher Export anbieten)
5. Vertragsformulierung und Preise für Freischaltungen
6. Welche 2–3 Kunden sind im Pilot, mit welchen Zielen
7. Design: einheitliche Marke für App, Landingpage, Social Media (Schriften lokal eingebunden)
8. Datenschutzerklärung + Einwilligungstexte (inkl. Eltern, KI-Übertragung USA) vor dem Pilot prüfen lassen
