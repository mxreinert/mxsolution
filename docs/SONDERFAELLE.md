# Sonderfälle und Entscheidungen

Ergänzung zu `docs/PLAN.md`. Details stehen im Plan, hier nur der Stand.
Ablage: `docs/SONDERFAELLE.md` · Stand: 28.09.2026

---

## ⏭️ Als Nächstes
1. **Übungsdatenbank festlegen** (feste Liste mit Muskelgruppe, Gerät, Videolink, optional Alternativen). Vorher nicht mit dem Trainingslog anfangen, sonst wird die Auswertung durch Schreibvarianten unbrauchbar.
2. **Recht & Datenschutz** (Abschnitt G) – bewusst verschoben, vor dem Pilot besprechen.

---

## ✅ Entschieden

### Allgemein
- Sprache: **Deutsch**
- Kommunikation: **WhatsApp bleibt Hauptkanal**, App verlinkt überall auf WhatsApp, kein Chat in der App
- App-Updates nachts, Info an Kunden per WhatsApp
- Verworfene Interessenten: Löschung nach **45 Tagen**
- Notfallkontakt wird in der **Anamnese** erfasst

### A. Kundenstatus
| Punkt | Entscheidung |
|---|---|
| A1 Krankheit | Kunde meldet im Heute-Screen/Check-in ab: Grund (Krankheit, Unfall, Verletzung, psychische Belastung, sonstiges) + Detailauswahl. Bei psychischer Belastung keine Details, Hinweis auf Hilfsangebote |
| A2 Verletzung | geklärt |
| A3 Vertragsverlängerung | geklärt (Vertrag) |
| A4 Erhaltung | Max schaltet um, alles stellt sich automatisch um |
| A5 Zielwechsel | ungern, erst Ziel abschließen; wenn nötig einfach im Dashboard umschalten |
| A6 Urlaub | regelt Max |
| A7 Prüfungen/Stress | Status Erhaltung |
| A8 Inaktivität | Statistik „App geöffnet" (Datum, Uhrzeit), Nachricht an Max nach X Tagen ohne Öffnen |
| A9 Ende | Max trägt ein → Export → schickt ihn → Login deaktiviert |
| A10 18. Geburtstag | in der App passiert nichts |
| A11 Wiedereinstieg | Export wieder importieren (Format muss einlesbar und versioniert sein) |
| A12 Pause auf Wunsch | Coaching wird pausiert |
| A13 Schwangerschaft, OP usw. | regelt Max |
| A14 Umzug | egal, nicht jeder hat PT |

### B. Daten eintragen
| Punkt | Entscheidung |
|---|---|
| B1 Tagesgrenze | **00:00 Uhr** Ortszeit |
| B2 Rückwirkend | bis **3 Tage**, Datum beim Eintragen wählbar; ab 24 h fehlend kommt Erinnerung „zeitnah eintragen" |
| B3 Korrigieren | bis 3 Tage selbst, danach über Max (WhatsApp) |
| B4 Lücken | „aus 5 von 7 Tagen" + Hinweis, vollständiger einzutragen; nie als 0 |
| B5 Einheiten | kg, km, kcal, Stunden |
| B6 Tippfehler | Plausibilitätswarnungen (kcal, Gewicht, Schritte, Schlaf, Satzgewicht) |
| B7 Schwankungen | neue Module **Kreatin (M13)** und **Zyklus (M14)**; Kreatin ist Teil von **Supplemente (M17)** |
| B8 Geräte | Kunde gibt Uhr/Apps am Anfang in den Einstellungen an |
| B9 Zeitzone | immer Ortszeit des Geräts |
| B10 | Button „Nicht getrackt" |
| B11 Mehrere Geräte | ja (Web-App) |
| B12 Rechte | Max darf alles und gibt frei; Kunde nur Tracking-Einträge in freigegebenen Modulen |

### C. Training
| Punkt | Entscheidung |
|---|---|
| C1 Übungsdatenbank | **kommt noch** (siehe „Als Nächstes") |
| C2 Gerät belegt | Alternativen möglich, niedrige Priorität |
| C3 Verschieben | „Andere Session" statt der heutigen starten |
| C4 Planwechsel | alles bleibt gespeichert, Pläne versioniert |
| C5 Freies Training | alles eintragbar inkl. Anstrengung, **nur wenn Max es pro Kunde freigibt** |
| C6 Satzarten | alle wie vorgeschlagen |
| C7 1RM | berechnet; selbst eingetragenes (getestetes) 1RM hat Vorrang |
| C8 Schmerzen | im Tracking eintragbar, Max wird benachrichtigt |
| C9 Deload | über den Plan |

### D. Konto und Zugang
| Punkt | Entscheidung |
|---|---|
| D1 Passwort vergessen | über WhatsApp an Max |
| D2 Handywechsel | neu einloggen, Daten bleiben |
| D3 Sitzung | 7 Tage eingeloggt, Abmelden in den Einstellungen |
| D4 Eltern | kein Login, dafür Modul **Eltern-Bericht (M15)**, von Max exportierbar |
| D6 Zwei-Faktor | ja, wenn kostenlos (TOTP per Authenticator-App, im Free-Tarif prüfen) |
| Neu | **Profilbild** für Kunden (klein, komprimiert) |

### E. Benachrichtigungen
| Punkt | Entscheidung |
|---|---|
| E1 Push geht nicht | Hinweis + In-App-Fallback |
| E2 Zu viele | **Mute-Modus** in den Kunden-Einstellungen, danach/morgens eine Übersicht „Das ist neu" – nur wenn etwas neu ist |
| E3–E6 | wie vorgeschlagen (Schulzeit-Ruhe, manuelle Nachricht, Abwesenheitsmodus, Antwortzeiten) |

### F. Personal Training
| Punkt | Entscheidung |
|---|---|
| Kontostand | Max bucht **+1** bei Zahlung, −1 bei durchgeführtem Termin, mit Verlauf; Kunde sieht Guthaben |
| Kalender | mit **Google Calendar** verbinden (kostenlos über API, Google-App auf „In Produktion" stellen) |
| F1–F7 | wie vorgeschlagen (Absagefrist, Absage Max, nicht erschienen, Verspätung, Ausweichort, mehrere Kunden, Hinweis bei niedrigem Stand) |

### H. Technik
| Punkt | Entscheidung |
|---|---|
| H1 Updates | nachts, Info per WhatsApp |
| H3 Testumgebung | ja, zweites Supabase-Projekt + Testkonto |
| H4 Offline | grundsätzlich online. KM Pacer als Modul offline. **Empfehlung bleibt:** Trainingslog lokal zwischenspeichern (Funkloch im Studio) |
| H5–H9 | wie vorgeschlagen |

### I. Für Kunden
- FAQ/Hilfe: **ja**
- Rest (Wissensbereich, Meilensteine, Abschlussbericht, Feedback-Umfrage, Empfehlungen, Barrierefreiheit): wie vorgeschlagen, spätere Phasen

---

## ⏸️ Verschoben

### G. Recht und Datenschutz (bald besprechen)
- G1 Datenschutzerklärung (inkl. Nutzungsstatistik, Zyklus, Krankmeldungen, KI)
- G2 Supabase-Region **EU (Frankfurt)** – muss **vor dem Anlegen des Projekts** feststehen, nachträglich nicht änderbar
- G2 Auftragsverarbeitungsverträge Supabase, Netlify, Anthropic, Google (Kalender)
- G3 Verzeichnis der Verarbeitungstätigkeiten
- G4 Löschfristen inkl. alter Backups und verschickter Exporte
- G5 Notfallplan Datenpanne (CNPD, 72 h)
- G6 Haftungshinweis
- G7 Gesundheits-Check (PAR-Q) in der Anamnese
- G8 Einwilligungen dokumentieren (Eltern, Zyklus, KI)
- G9 Auskunftsfrist 1 Monat
- G10 Gewerbe, Versicherung, Rechnungen in Luxemburg
- Neu: Versand von Exporten per WhatsApp – ok oder anderer Weg?

### J. Sicherheit
- J2 Warnsignale für Max (sehr niedrige kcal, schneller Gewichtsverlust, Motivation/Schlaf dauerhaft niedrig, Schmerzen)
- J3 Notfall im PT (112, Defibrillator am Ort)
- J4 Umgang mit ernsten persönlichen Problemen (an wen verweist Max?)
