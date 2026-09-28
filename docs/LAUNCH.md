# LAUNCH-CHECKLISTE – vor dem großen Deploy

Diese Notiz vor dem Launch (erste echte Kunden) durchgehen. Alles abhaken, bevor Kunden-Konten angelegt werden.
Ablage: `docs/LAUNCH.md`

---

## 1. Muss in Verträge und Einwilligungen

**Coaching-Vertrag**
- [ ] Leistungen und Laufzeit, was Standard ist, was freigeschaltet wird (Premium)
- [ ] Pause/Krankheit: ab wann verlängert sich die Laufzeit, max. Pausendauer
- [ ] Personal Training: Absagefrist (z. B. 24 h), kurzfristige Absage, Nichterscheinen, PT-Kontostand/Guthaben, Verfall von Guthaben
- [ ] Antwortzeiten von Max (z. B. Check-in-Feedback innerhalb 48 h)
- [ ] Kommunikation über WhatsApp
- [ ] Konto darf nicht geteilt werden
- [ ] Ende: Export, Deaktivierung, Löschfrist
- [ ] Haftungshinweis: keine medizinische Beratung, bei Beschwerden Arzt
- [ ] Nutzung von Ergebnissen/Vorher-Nachher für Social Media nur mit gesonderter Zustimmung

**Datenschutz-Einwilligung Kunde**
- [ ] Welche Daten (alle aktiven Module, Krankmeldungen inkl. psychischer Belastung, Profilbild, Notfallkontakt)
- [ ] **Nutzungsstatistik** (wann die App geöffnet wird)
- [ ] Zyklus-Modul: eigene Einwilligung
- [ ] KI-Analyse: eigene Einwilligung, Übertragung an Anthropic (USA)
- [ ] Hevy: API-Key und Datenabruf
- [ ] Google Calendar: Termindaten (Name, Ort, Zeit) liegen in Max' Google-Kalender
- [ ] Löschfristen: Interessenten 45 Tage, beendete Kunden (Frist festlegen)
- [ ] Rechte: Auskunft, Export, Löschung, Widerruf – über Max per WhatsApp

**Minderjährige**
- [ ] Einwilligung der Eltern mit allen Punkten oben (inkl. Zyklus, KI, Fotos, falls genutzt)
- [ ] Eltern-Bericht (M15): wer bekommt was

**Interessenten**
- [ ] Einwilligung zur Anamnese vor Vertrag + Hinweis auf Löschung nach 45 Tagen

---

## 2. Muss technisch vor dem Launch stehen (nicht per Vertrag lösbar)

- [ ] Supabase-Projekt in **EU-Region (Frankfurt)** – gilt schon für das allererste Anlegen
- [ ] Auftragsverarbeitungsverträge (DPA) von Supabase, Netlify, Anthropic, Google akzeptiert und abgelegt
- [ ] Zwei-Faktor-Login für Max' Dashboard aktiv
- [ ] Row Level Security in Supabase getestet: Kunde A sieht **nichts** von Kunde B (mit zwei Testkonten ausprobieren)
- [ ] Export pro Kunde funktioniert und ist wieder importierbar
- [ ] Löschung pro Kunde löscht wirklich alles (inkl. Profilbild, Fotos)
- [ ] Automatische Löschung verworfener Interessenten nach 45 Tagen läuft
- [ ] Erstes Gesamt-Backup gemacht, Backup-Erinnerung aktiv
- [ ] Datenschutzerklärung in App und auf mxreinert.de verlinkt
- [ ] Impressum auf mxreinert.de
- [ ] Keine externen Einbindungen (Schriften lokal, keine Tracker) – einmal mit Browser-Entwicklertools prüfen
- [ ] Getestet auf iPhone (Safari, Homescreen), Android (Chrome), einem älteren Gerät
- [ ] Push auf iPhone und Android getestet
- [ ] Testkonto aus Kundensicht einmal komplett durchgespielt (Onboarding → Abend-Check → Training → Check-in → Krankmeldung → Rückkehr)
- [ ] Hilfsangebot-Nummer bei „psychische Belastung" geprüft

---

## 3. Organisatorisch (außerhalb der App)

- [ ] Gewerbe/Niederlassungsgenehmigung, Rechnungen, Steuern in Luxemburg geklärt
- [ ] Berufshaftpflicht
- [ ] Notfallplan Datenpanne aufgeschrieben (wer, was, CNPD innerhalb 72 h)
- [ ] Verzeichnis der Verarbeitungstätigkeiten (eine Tabelle reicht)
- [ ] Weg für Exporte an Kunden festgelegt (WhatsApp oder anders)
- [ ] Kurzanleitung „Zum Homescreen hinzufügen" als Bild/PDF fertig
- [ ] WhatsApp-Nachricht für Launch und Updates vorbereitet
