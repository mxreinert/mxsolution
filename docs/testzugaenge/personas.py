"""Fictional pilot test persons (no real people, no real health data).

days: (Tag, Gewicht, kcal, Protein, KH, Fett, Schritte, aktive kcal, Schlaf h, Schlafqualität, Motivation, Energie,
       Ruhepuls, HRV, Supplemente, Training/Cardio, Besonderes, Zeilenstil)   '–' = für diese Person nicht aktiv
       Zeilenstil: '' | 'pink' (Periode) | 'grey' (erst am nächsten Tag nachtragen) | 'amber' (Tippfehler-Test)
workouts: (Tag, Einheit, Hinweis, [(Übung, Sätze)])   W = Aufwärmsatz, D = Dropsatz, 🏅 = neuer Rekord,
          +kg = Zusatzgewicht, Hilfe = Unterstützung an der Maschine, L/R = je Seite
"""

LENA = {
    'n': 1, 'username': 'test.lena', 'first': 'Lena', 'last': 'Becker (Test)', 'sex': 'weiblich',
    'birth': '14.03.2002', 'age': 24, 'height': 168, 'start_weight': '72,4 kg', 'goal': 'Fettabbau (Cut)',
    'tempo': '−0,5 kg pro Woche', 'goal_text': 'Bis zum Sommer 6 kg Fett verlieren und dabei die Kraft halten.',
    'facts': 'Bürojob · seit 1 Jahr im Gym (3× Ganzkörper) · wandert gern · trackt mit Yazio · Apple Watch · '
             'Kreatin, Vitamin D3, Whey · Zyklus ca. 29 Tage · linkes Knie zwickt manchmal',
    'supp_legend': 'K = Kreatin, D = Vitamin D3, W = Whey',
    'legend': 'Rosa = Periode (Wasser: +1–1,5 kg sind normal) · gelb = Tippfehler-Test: erst den falschen Wert eintragen, Warnung ansehen, dann korrigieren · '
              'grau = an diesem Tag nichts eintragen, erst am nächsten Tag über 📅 nachtragen.',
    'days': [
        (1, '72,4', 1720, 128, 165, 58, '8.400', 420, '7,5', 4, 4, 4, 62, 48, 'K D W', 'Kraft A', 'Start: Umfänge + Foto', ''),
        (2, '71,8', 1810, 135, 180, 57, '6.200', 380, '6,5', 3, 4, 3, 63, 45, 'K D', 'Laufband 25 min · 3,2 km · locker', '', ''),
        (3, '72,6', 1690, 122, 160, 60, '9.100', 470, '7,0', 4, 4, 4, 61, 50, 'K D W', 'Kraft B', '+0,8 kg: gestern Pizza (salzig) → Wasser', ''),
        (4, '72,0', 2150, 110, 240, 78, '11.800', 610, '8,5', 5, 5, 4, 60, 52, '–', 'Spazieren 45 min · 4,0 km · locker', 'Essen mit Freunden · Supplemente vergessen', ''),
        (5, '73,1', 1760, 131, 170, 58, '7.600', 400, '7,0', 3, 4, 3, 62, 47, 'K D W', 'Kraft A', '+1,1 kg nach dem Restaurant – nur Wasser', ''),
        (6, '72,4', 1980, 118, 210, 72, '5.200', 290, '6,0', 2, 2, 2, 66, 40, 'K D', '–', 'Periode beginnt', 'pink'),
        (7, '73,3', 1850, 125, 190, 66, '6.900', 350, '7,5', 3, 2, 2, 65, 41, 'K D', 'Indoor-Cycling 30 min · Intervall', 'Periode · Check-in 1', 'pink'),
        (8, '73,6', 1700, 133, 158, 59, '8.800', 450, '7,0', 3, 2, 3, 64, 43, 'K D W', 'Kraft B', 'Periode · Knie melden', 'pink'),
        (9, '7,32 → 73,2', 1740, 129, 168, 60, '9.400', 480, '7,5', 4, 3, 3, 62, 47, '–', '–', 'Periode · Tippfehler · Termin anfragen', 'pink'),
        (10, '72,5', 1680, 136, 152, 57, '8.100', 430, '7,0', 4, 4, 4, 61, 49, 'K D W', 'Kraft A (anderes Gym)', 'Periode endet', 'pink'),
        (11, '71,9', 2300, 105, 260, 82, '21.500', 1150, '8,0', 5, 5, 4, 60, 53, 'K D', 'Wandern 120 min · 9,0 km · lang', '', ''),
        (12, '72,8', 1720, 132, 162, 58, '7.300', 380, '6,5', 3, 4, 3, 62, 46, 'K D', '–', '+0,9 kg nach dem Wandertag · erst an Tag 13 nachtragen', 'grey'),
        (13, '71,6', 1750, 134, 166, 59, '7.900', 410, '7,0', 4, 4, 4, 61, 50, 'K D W', 'Kraft B + Laufen 3 km mit KM Pacer', '', ''),
        (14, '71,4', 1690, 130, 158, 58, '8.600', 440, '7,5', 4, 5, 4, 60, 52, 'K D', '–', 'Ende: Umfänge + Foto · Check-in 2', ''),
    ],
    'train_lead': 'Supersatz: erst Seitheben, dann direkt Trizeps, dann Pause.',
    'workouts': [
        (1, 'A', '', [
            ('Kniebeuge (Back Squat)', 'W 25×10 · 50×10 · 50×9 · 50×8'),
            ('Kurzhantel-Bankdrücken', '14×12 · 14×11 · 14×10'),
            ('Latzug V-Griff (Neutralgriff)', '40×12 · 40×11 · 40×10'),
            ('Hip Thrust', '70×12 · 70×12 · 70×11'),
            ('Plank', '45 s · 45 s · 40 s'),
        ]),
        (3, 'B', '', [
            ('Rumänisches Kreuzheben', 'W 25×10 · 45×10 · 45×10 · 45×9'),
            ('KH-Schulterdrücken sitzend', '10×12 · 10×11 · 10×10'),
            ('Kabelrudern breiter Griff', '35×12 · 35×12 · 35×12'),
            ('Ausfallschritte rückwärts', '3 Sätze je Seite: L 8×10 · R 8×10'),
            ('Supersatz: Seitheben KH + Trizepsdrücken Seil', '5×15 + 15×15 · 5×14 + 15×13 · 5×12 + 15×12'),
        ]),
        (5, 'A', 'Latzug ist „belegt“: über ⋮ → Übung tauschen → Latzug breit', [
            ('Kniebeuge (Back Squat)', 'W 25×10 · 50×10 · 50×10 · 50×9'),
            ('Kurzhantel-Bankdrücken', '14×12 · 14×12 · 14×11'),
            ('Latzug breit (getauscht)', '40×12 · 40×11 · 40×10'),
            ('Hip Thrust', '70×12 · 70×12 · 70×12'),
            ('Plank', '50 s · 50 s · 45 s'),
        ]),
        (8, 'B', 'Nach dem Training: Schmerzen „Ja“ → „linkes Knie bei Ausfallschritten“', [
            ('Rumänisches Kreuzheben', 'W 25×10 · 45×10 · 45×10 · 45×10'),
            ('KH-Schulterdrücken sitzend', '10×12 · 10×12 · 10×11'),
            ('Kabelrudern breiter Griff', '37,5×12 🏅 · 37,5×11 · 37,5×10'),
            ('Ausfallschritte rückwärts', '3 Sätze je Seite: L 8×10 · R 8×8'),
            ('Supersatz: Seitheben KH + Trizepsdrücken Seil', '5×15 + 15×15 · 5×15 + 15×14 · 5×13 + 15×13'),
        ]),
        (10, 'A', 'Schalter „Anderes Gym“ an – fremdes Studio, alles leichter', [
            ('Kniebeuge (Back Squat)', 'W 20×10 · 45×10 · 45×10 · 45×10'),
            ('Kurzhantel-Bankdrücken', '12×12 · 12×12 · 12×12'),
            ('Latzug V-Griff (Neutralgriff)', '35×12 · 35×12 · 35×12'),
            ('Hip Thrust', '60×12 · 60×12 · 60×12'),
            ('Plank', '50 s · 50 s · 50 s'),
        ]),
        (13, 'B', 'Danach „Freies Training“ starten und selbst hinzufügen: Kettlebell Swing 12×15 · 12×15 · 12×15', [
            ('Rumänisches Kreuzheben', 'W 25×10 · 47,5×10 🏅 · 47,5×9 · 47,5×9'),
            ('KH-Schulterdrücken sitzend', '11×11 · 11×10 · 11×10'),
            ('Kabelrudern breiter Griff', '37,5×12 · 37,5×12 · 37,5×12'),
            ('Ausfallschritte rückwärts', '3 Sätze je Seite: L 9×10 · R 9×10'),
            ('Supersatz: Seitheben KH + Trizepsdrücken Seil', '6×12 + 17,5×12 · 6×12 + 17,5×12 · 6×11 + 17,5×11'),
        ]),
    ],
    'measure': [('Taille', '76,0', '74,5'), ('Hüfte', '101,0', '100,0'), ('Brust', '92,0', '91,5'), ('Oberarm', '28,0', '27,8'), ('Oberschenkel', '58,0', '57,2')],
    'checkins': [
        (7, 'gut', 'viel', 'mittel', 'okay', 'Heißhunger auf Süßes in der Periode, Waage springt hoch, Knie zwickt.'),
        (14, 'sehr gut', 'normal', 'wenig', 'gut', 'Wandertag war super, Gewicht geht langsam runter.'),
    ],
    'cycle': 'Tag 6 „Periode hat begonnen“, Tag 10 „Periode ist zu Ende“ (beides im Abend-Check). An Tag 6–9 steht unter dem Gewicht ein rosa Hinweis.',
    'request': 'Tag 9: Profil → „Termin anfragen“ → Online-Call: „Kurzer Call wegen meinem Knie, am liebsten Do oder Fr ab 18 Uhr.“',
    'checks': [
        ['Login, eigenes Passwort, Einführung', 'Homescreen + Push-Erinnerungen kommen', 'Ringe auf „Heute“ füllen sich', 'Tippfehler-Warnung (Tag 9)',
         'Nachtragen über 📅 (Tag 13)', '„Nicht getrackt“ einmal testen', 'Farbmodus im Profil wechseln'],
        ['Satz abhaken → Zeile wird grün', '„Vorher“ antippen übernimmt alte Werte', 'Pausentimer −15 / +15 / Überspringen', 'Supersatz: keine Pause dazwischen',
         '🏅 bei Rekord (Tag 8, 13)', '„Anderes Gym“ (Tag 10)', 'Freies Training (Tag 13)'],
        ['Löwe nach dem 1. Training und bei „3/7 Tage am Stück“', 'Rosa Zyklus-Hinweis beim Gewicht', 'Gewichtsgrafik: Sprünge trotzdem Abwärtstrend im 7-Tage-Schnitt',
         'Foto + Umfänge-Vergleich', 'Check-in, Antwort von Max', 'Terminanfrage, Antwort sehen', 'Abmelden und wieder anmelden'],
    ],
    'setup': {
        'create': 'Einwilligung = heute',
        'modules': 'Krafttraining, Cardio, Körpergewicht, Ernährung, Aktivität, Schlaf, Motivation & Befinden, Uhr-Werte, Supplemente, Zyklus, Erfolge',
        'unlocks': 'Fotos & Umfänge, Freies Training (beim Krafttraining unter „Freigaben“)',
        'consents': 'Zyklus und Fortschrittsfotos: Einwilligungs-Datum = Tag der Einrichtung',
        'calc': 'Rechner: weiblich, 24, 168 cm, 72,4 kg, „Mäßig aktiv“, −0,5 kg/Woche, Protein 2,0 g/kg, Fett 0,8 g/kg → ca. 1.760 kcal · 145 g P · 58 g F · 165 g KH → „Als Ziele übernehmen“',
        'targets': 'Schritte 8.000 · Schlaf 7,5 h · Cardio 90 min/Woche (Vorgabe: Di Laufband 25 min locker, Sa Wandern 60 min)',
        'plan': 'Vorlage „Ganzkörper A/B (Test)“, 3 Einheiten/Woche, 6 Wochen, Deload Woche 6. '
                'A: Kniebeuge 3×8–10 (1 Aufw.), KH-Bankdrücken 3×8–12, Latzug V-Griff 3×10–12, Hip Thrust 3×10–12, Plank 3×45 s. '
                'B: Rum. Kreuzheben 3×8–10 (1 Aufw.), KH-Schulterdrücken sitzend 3×10–12, Kabelrudern breiter Griff 3×10–12, '
                'Ausfallschritte rückwärts 3×10, Seitheben KH 3×12–15 + Trizepsdrücken Seil 3×12–15 (Supersatz „A“). RIR 2, Pause 120 s.',
        'supps': 'Kreatin 5 g (täglich), Vitamin D3 (täglich), Whey (Trainingstage)',
        'other': 'Check-in-Tag = Wochentag von Tag 7',
    },
}

JONAS = {
    'n': 2, 'username': 'test.jonas', 'first': 'Jonas', 'last': 'Weber (Test)', 'sex': 'männlich',
    'birth': '02.07.2005', 'age': 21, 'height': 182, 'start_weight': '74,0 kg', 'goal': 'Muskelaufbau (Bulk)',
    'tempo': '+0,25 kg pro Woche', 'goal_text': 'Sauber zunehmen: mehr Muskeln, möglichst wenig Fett.',
    'facts': 'Student · trainiert seit 3 Jahren · Push/Pull/Beine · trackt mit MyFitnessPal · keine Uhr (Schritte vom Handy) · '
             'Kreatin, Whey, Omega-3 · isst viel Reis, Hähnchen, Haferflocken',
    'supp_legend': 'K = Kreatin, W = Whey, O = Omega-3',
    'legend': 'Gewicht schwankt beim Zunehmen stark (Reis, Salz, Party) – wichtig ist der 7-Tage-Schnitt · gelb = Tippfehler-Test · '
              'grau = erst am nächsten Tag über 📅 nachtragen · „nicht getrackt“ = in der Ernährung den Knopf „nicht getrackt“ tippen · – = für dich nicht aktiv.',
    'days': [
        (1, '74,0', 3050, 160, 420, 85, '7.200', '–', '7,5', 4, 5, 5, '–', '–', 'K W O', 'Push', 'Start', ''),
        (2, '74,7', 3200, 150, 460, 88, '9.800', '–', '8,0', 4, 4, 4, '–', '–', 'K O', 'Spazieren 40 min · 3,5 km · locker', '+0,7 kg nach viel Reis – Glykogen + Wasser', ''),
        (3, '74,2', 2980, 165, 400, 82, '6.900', '–', '7,0', 3, 4, 4, '–', '–', 'K W O', 'Pull', '', ''),
        (4, '75,1', 3300, 140, 480, 95, '5.400', '–', '5,5', 2, 3, 2, '–', '–', 'K O', '–', 'Party, wenig Schlaf, salzig gegessen', ''),
        (5, '74,4', 3100, 170, 410, 86, '8.100', '–', '7,5', 4, 4, 4, '–', '–', 'K W O', 'Beine', '', ''),
        (6, '74,3', 'nicht getrackt', '–', '–', '–', '10.200', '–', '8,5', 5, 5, 5, '–', '–', 'K O', 'Fußball 60 min · Intervall', 'Geburtstag – Ernährung „nicht getrackt“', ''),
        (7, '75,2', 3050, 158, 415, 84, '7.700', '–', '7,0', 4, 4, 4, '–', '–', 'K O', '–', 'Check-in 1', ''),
        (8, '74,6', 3150, 162, 430, 88, '7.300', '–', '7,5', 4, 5, 4, '–', '–', 'K W O', 'Push', 'Dropsatz + Rekord', ''),
        (9, '74,5', 2900, 148, 390, 80, '6.800', '–', '7,0', 3, 4, 4, '–', '–', '–', '–', 'Supplemente vergessen · Termin anfragen', ''),
        (10, '75,5', 3250, 170, 440, 90, '8.400', '–', '7,5', 4, 5, 4, '–', '–', 'K W O', 'Pull', 'Gerät belegt → Übung tauschen', ''),
        (11, '74,8', 3000, 155, 405, 85, '11.200', '–', '8,0', 5, 5, 5, '–', '–', 'K O', 'Radfahren draußen 50 min · 18 km · locker', '', ''),
        (12, '750 → 75,0', 3100, 165, 420, 86, '7.900', '–', '7,0', 4, 4, 4, '–', '–', 'K W O', 'Beine', 'Tippfehler 750 → Warnung → 75,0', 'amber'),
        (13, '75,6', 3050, 160, 410, 87, '6.500', '–', '7,5', 4, 4, 4, '–', '–', 'K O', '–', 'erst an Tag 14 über 📅 nachtragen', 'grey'),
        (14, '75,1', 3150, 162, 425, 88, '8.200', '–', '7,0', 4, 5, 4, '–', '–', 'K O', '–', 'Check-in 2 · Erfolge-Seite ansehen', ''),
    ],
    'train_lead': '+10 = Zusatzgewicht (Dips, Klimmzug: Feld „+KG“), D = Dropsatz (Satznummer antippen → Dropsatz), L/R = je Seite.',
    'workouts': [
        (1, 'Push', '', [
            ('Bankdrücken', 'W 40×10 · 70×8 · 70×8 · 70×7'),
            ('Kurzhantel-Schrägbankdrücken', '26×10 · 26×9 · 26×8'),
            ('Dips (Brust)', '+10×10 · +10×9 · +10×8'),
            ('Seitheben Kabel einarmig', '3 Sätze je Seite: L 7,5×15 · R 7,5×15'),
            ('Trizepsdrücken Seil', '25×12 · 25×12 · 25×10 · D 15×10'),
        ]),
        (3, 'Pull', '', [
            ('Klimmzug', '+0×10 · +0×9 · +0×7'),
            ('Langhantelrudern vorgebeugt', 'W 40×10 · 70×10 · 70×9 · 70×8'),
            ('Kabelrudern sitzend, enger Griff (Lat)', '60×12 · 60×11 · 60×10'),
            ('Face Pulls', '20×15 · 20×15 · 20×15'),
            ('SZ-Curls', '30×10 · 30×9 · 30×8'),
        ]),
        (5, 'Beine', '', [
            ('Kniebeuge (Back Squat)', 'W 60×8 · 100×6 · 100×6 · 100×5'),
            ('Rumänisches Kreuzheben', '90×10 · 90×9 · 90×8'),
            ('Beinpresse', '180×12 · 180×11 · 180×10'),
            ('Beinbeuger sitzend', '50×12 · 50×12 · 50×11'),
            ('Wadenheben stehend', '80×15 · 80×15 · 80×14'),
        ]),
        (8, 'Push', '', [
            ('Bankdrücken', 'W 40×10 · 72,5×8 🏅 · 72,5×7 · 72,5×7'),
            ('Kurzhantel-Schrägbankdrücken', '26×10 · 26×10 · 26×9'),
            ('Dips (Brust)', '+12,5×10 🏅 · +12,5×9 · +12,5×8'),
            ('Seitheben Kabel einarmig', '3 Sätze je Seite: L 7,5×15 · R 7,5×14'),
            ('Trizepsdrücken Seil', '27,5×12 · 27,5×11 · 27,5×10 · D 17,5×10'),
        ]),
        (10, 'Pull', 'Kabelrudern ist „belegt“: ⋮ → Übung tauschen → Rudermaschine (brustgestützt)', [
            ('Klimmzug', '+0×11 🏅 · +0×9 · +0×8'),
            ('Langhantelrudern vorgebeugt', 'W 40×10 · 72,5×9 · 72,5×9 · 72,5×8'),
            ('Rudermaschine (getauscht)', '50×12 · 50×12 · 50×11'),
            ('Face Pulls', '22,5×15 · 22,5×15 · 22,5×14'),
            ('SZ-Curls', '32,5×9 · 32,5×8 · 30×9'),
        ]),
        (12, 'Beine', '', [
            ('Kniebeuge (Back Squat)', 'W 60×8 · 102,5×6 🏅 · 102,5×6 · 102,5×5'),
            ('Rumänisches Kreuzheben', '92,5×10 · 92,5×9 · 92,5×9'),
            ('Beinpresse', '190×12 · 190×11 · 190×10'),
            ('Beinbeuger sitzend', '52,5×12 · 52,5×11 · 52,5×11'),
            ('Wadenheben stehend', '85×15 · 85×15 · 85×13'),
        ]),
    ],
    'measure': [('Taille', '79,0', '79,5'), ('Brust', '98,0', '99,0'), ('Oberarm', '35,0', '35,5'), ('Oberschenkel', '57,0', '57,5')],
    'checkins': [
        (7, 'gut', 'wenig', 'mittel', 'okay', 'So viel essen ist anstrengend, nach der Party müde.'),
        (14, 'sehr gut', 'wenig', 'wenig', 'gut', 'Neue Rekorde im Bankdrücken und bei Klimmzügen.'),
    ],
    'request': 'Tag 9: Profil → „Termin anfragen“ → Personal Training: „Technik-Check Kniebeuge, Mo oder Mi ab 17 Uhr.“',
    'checks': [
        ['Login, eigenes Passwort, Einführung', 'Homescreen + Push erlauben', 'Ringe: Kalorien (Überschuss!), Protein', '„Nicht getrackt“ bei der Ernährung (Tag 6)',
         'Tippfehler-Warnung (Tag 12)', 'Nachtragen über 📅 (Tag 14)', 'Abend-Check fragt keine aktiven kcal ab'],
        ['Zusatzgewicht bei Dips/Klimmzug (+KG)', 'Dropsatz „D“ (Tag 1, 8)', 'Einseitig L/R beim Seitheben', '🏅 bei Rekord (Tag 8, 10, 12)',
         'Übung tauschen (Tag 10)', 'Pausentimer und „Vorher“', 'Kraftverlauf (1RM) Bankdrücken'],
        ['Gewichtsgrafik: 7-Tage-Schnitt steigt leicht trotz Sprüngen', 'Wochenziel +0,25 kg in der Auswertung', 'Löwe bei Erfolgen, Erfolge-Seite',
         'Check-in, Antwort von Max', 'Terminanfrage, Antwort sehen', 'Farbmodus „Schwarz-Blau“ ausprobieren', 'Abmelden und wieder anmelden'],
    ],
    'setup': {
        'create': 'Einwilligung = heute',
        'modules': 'Krafttraining, Cardio, Körpergewicht, Ernährung, Aktivität, Schlaf, Motivation & Befinden, Supplemente, Erfolge',
        'unlocks': '–',
        'consents': '–',
        'calc': 'Rechner: männlich, 21, 182 cm, 74,0 kg, „Mäßig aktiv“, +0,25 kg/Woche, Protein 1,8 g/kg, Fett 0,8 g/kg → ca. 3.030 kcal · 133 g P · 59 g F · 492 g KH → „Als Ziele übernehmen“',
        'targets': 'Aktivität: im Abend-Check nur „Schritte“ abfragen (Feld „aktive kcal“ aus) · Schritte 7.000 · Schlaf 8 h',
        'plan': 'Vorlage „Push/Pull/Beine (Test)“, 3 Einheiten/Woche, 8 Wochen. Push: Bankdrücken 3×6–8 (1 Aufw.), KH-Schrägbank 3×8–10, Dips (Brust) 3×8–10, '
                'Seitheben Kabel einarmig 3×12–15, Trizepsdrücken Seil 3×10–12. Pull: Klimmzug 3×6–10, LH-Rudern 3×8–10 (1 Aufw.), Kabelrudern eng 3×10–12, '
                'Face Pulls 3×15, SZ-Curls 3×8–10. Beine: Kniebeuge 3×5–6 (1 Aufw.), Rum. Kreuzheben 3×8–10, Beinpresse 3×10–12, Beinbeuger sitzend 3×10–12, '
                'Wadenheben stehend 3×12–15. RIR 1–2, Pause 150 s.',
        'supps': 'Kreatin 5 g (täglich), Whey (Trainingstage), Omega-3 (täglich)',
        'other': 'Check-in-Tag = Wochentag von Tag 7',
    },
}

TOM = {
    'n': 3, 'username': 'test.tom', 'first': 'Tom', 'last': 'Schmitt (Test)', 'sex': 'männlich',
    'birth': '21.11.1991', 'age': 34, 'height': 178, 'start_weight': '79,0 kg', 'goal': 'Laufen/Ausdauer',
    'tempo': '10 km unter 50 Minuten', 'goal_text': 'In 8 Wochen 10 km unter 50 Minuten laufen (aktuell 54 Minuten).',
    'facts': 'Lehrer · läuft 3× pro Woche · Garmin-Uhr (Schritte, aktive kcal, Schlaf, Ruhepuls, HRV) · trackt sein Essen nicht · '
             'Magnesium · rechte Achillessehne empfindlich · 2× pro Woche Kräftigung',
    'supp_legend': 'M = Magnesium',
    'legend': 'Läufe immer mit Dauer, Distanz, Intensität, Ø Puls und Anstrengung eintragen · Läufe mit „KM Pacer“ direkt mit dem KM Pacer laufen · '
              'gelb = Tippfehler-Test · grau = erst am nächsten Tag über 📅 nachtragen (Cardio mit dem richtigen Datum!) · – = nicht aktiv.',
    'days': [
        (1, '79,0', '–', '–', '–', '–', '9.800', 620, '7,5', 4, 5, 4, 54, 68, 'M', 'Laufen 40 min · 7,2 km · locker · Puls 141 · Anstr. 4', 'Start', ''),
        (2, '79,5', '–', '–', '–', '–', '6.200', 310, '7,0', 4, 4, 4, 55, 64, 'M', 'Kraft A (Läufer-Stabi)', '', ''),
        (3, '78,7', '–', '–', '–', '–', '12.400', 780, '6,5', 3, 4, 3, 57, 58, 'M', 'Intervall mit KM Pacer: 6 × 1 km · 50 min · 9,0 km · Puls 158 · Anstr. 8', 'KM Pacer benutzen', ''),
        (4, '79,1', '–', '–', '–', '–', '7.100', 350, '8,0', 5, 4, 4, 55, 66, 'M', '–', 'Ruhetag', ''),
        (5, '78,6', '–', '–', '–', '–', '119.000 → 11.900', 700, '7,5', 4, 5, 4, 54, 69, 'M', 'Laufen 45 min · 8,0 km · locker · Puls 139 · Anstr. 4', 'Tippfehler bei Schritten', 'amber'),
        (6, '79,8', '–', '–', '–', '–', '5.900', 300, '5,5', 2, 3, 2, 59, 52, '–', '–', 'Grillabend, wenig Schlaf, HRV runter · Supplemente vergessen', ''),
        (7, '79,3', '–', '–', '–', '–', '16.800', 1050, '7,5', 4, 4, 4, 56, 61, 'M', 'Langer Lauf 75 min · 12,5 km · lang · Puls 145 · Anstr. 6', 'Check-in 1', ''),
        (8, '78,9', '–', '–', '–', '–', '6.400', 320, '8,0', 5, 4, 4, 54, 70, 'M', '–', 'Termin anfragen', ''),
        (9, '79,4', '–', '–', '–', '–', '7.000', 340, '7,0', 4, 4, 4, 55, 66, 'M', 'Kraft B (Läufer-Stabi)', '', ''),
        (10, '78,5', '–', '–', '–', '–', '13.100', 820, '7,5', 4, 5, 5, 53, 72, 'M', 'Intervall mit KM Pacer: 5 × 1,2 km · 52 min · 9,5 km · Puls 160 · Anstr. 8', 'schnellste Pace bisher', ''),
        (11, '78,9', '–', '–', '–', '–', '8.200', 410, '7,0', 4, 4, 4, 55, 66, 'M', 'Seilspringen 15 min · HIIT 15 min', 'erst an Tag 12 über 📅 nachtragen', 'grey'),
        (12, '78,8', '–', '–', '–', '–', '6.800', 330, '7,0', 4, 4, 4, 55, 67, 'M', 'Crosstrainer 30 min · locker', 'Art aus „Weitere“ wählen', ''),
        (13, '79,2', '–', '–', '–', '–', '5.500', 260, '8,5', 5, 4, 4, 54, 71, 'M', '–', 'Ruhetag', ''),
        (14, '78,4', '–', '–', '–', '–', '18.900', 1180, '7,5', 4, 5, 5, 53, 73, 'M', 'Langer Lauf 80 min · 13,5 km · lang · Puls 143 · Anstr. 6', 'Check-in 2', ''),
    ],
    'train_lead': 'Läufer-Kräftigung. L/R = je Seite. Zeit-Übungen in Sekunden.',
    'workouts': [
        (2, 'A', '', [
            ('Bulgarian Split Squat', '3 Sätze je Seite: L 12×10 · R 12×10'),
            ('Rumänisches Kreuzheben Kurzhantel', '22×10 · 22×10 · 22×10'),
            ('Wadenheben einbeinig', '3 Sätze je Seite: L 10×15 · R 10×15'),
            ('Plank', '60 s · 60 s · 50 s'),
            ('Seitstütz', '3 Sätze je Seite: 40 s'),
        ]),
        (9, 'B', 'Danach Schmerzen „Ja“ → „rechte Achillessehne leicht“', [
            ('Hip Thrust', '80×12 · 80×12 · 80×11'),
            ('Step-Ups', '3 Sätze je Seite: L 10×10 · R 10×10'),
            ('Nordic Curls', '5 · 5 · 4 Wiederholungen'),
            ('Dead Bug', '12 · 12 · 12 Wiederholungen'),
            ('Wadenheben einbeinig', '3 Sätze je Seite: L 12×15 🏅 · R 12×15'),
        ]),
    ],
    'measure': [],
    'checkins': [
        (7, 'gut', 'normal', 'mittel', 'okay', 'Grillabend, schlecht geschlafen, Intervalle waren hart.'),
        (14, 'sehr gut', 'normal', 'wenig', 'gut', 'Intervalle werden schneller, Achillessehne beobachten.'),
    ],
    'request': 'Tag 8: Profil → „Termin anfragen“ → Online-Call: „Laufplan für die 10 km besprechen, Wochenende vormittags.“',
    'checks': [
        ['Login, eigenes Passwort, Einführung', 'Homescreen + Push erlauben', 'Abend-Check fragt keine Ernährung ab', 'Uhr-Werte: Ruhepuls + HRV eintragen',
         'Tippfehler bei Schritten (Tag 5)', 'Nachtragen über 📅 (Tag 12)', 'Ringe: Schritte + Woche'],
        ['KM Pacer: Intervall-Lauf (Tag 3, 10)', 'Lauf aus dem KM Pacer erscheint unter Cardio', 'Cardio-Arten aus „Häufigste“ und „Weitere“', 'Pace-Verlauf in der Auswertung',
         'Wochenziel 180 min Cardio', 'Kräftigung: Zeit-Übungen (Sekunden)', 'Schmerzen melden (Tag 9)'],
        ['Auswertung Schlaf, Ruhepuls, HRV', 'Gewicht ohne Ziel-Tempo', 'Löwe bei Erfolgen', 'Check-in, Antwort von Max', 'Terminanfrage, Antwort sehen',
         'Push-Erinnerung zur eingestellten Zeit', 'Abmelden und wieder anmelden'],
    ],
    'setup': {
        'create': 'Einwilligung = heute',
        'modules': 'Cardio, Aktivität, Schlaf, Motivation & Befinden, Uhr-Werte, Körpergewicht, Krafttraining, Supplemente, Erfolge (Ernährung aus)',
        'unlocks': '–',
        'consents': '–',
        'calc': '– (Ernährung nicht aktiv)',
        'targets': 'Cardio 180 min/Woche, Vorgabe: Di Intervall 50 min, Do locker 45 min, Sa lang 75 min · Schritte 10.000 · Schlaf 8 h · Gewicht: kein Ziel-Tempo',
        'plan': 'Vorlage „Läufer-Kräftigung (Test)“, 1 Einheit/Woche. A: Bulgarian Split Squat 3×10, Rum. Kreuzheben KH 3×10, Wadenheben einbeinig 3×15, Plank 3×60 s, Seitstütz 3×40 s. '
                'B: Hip Thrust 3×12, Step-Ups 3×10, Nordic Curls 3×5, Dead Bug 3×12, Wadenheben einbeinig 3×15. RIR 2, Pause 90 s.',
        'supps': 'Magnesium (täglich, abends)',
        'other': 'Check-in-Tag = Wochentag von Tag 7',
    },
}

ANNA = {
    'n': 4, 'username': 'test.anna', 'first': 'Anna', 'last': 'Hoffmann (Test)', 'sex': 'weiblich',
    'birth': '09.05.1985', 'age': 41, 'height': 165, 'start_weight': '64,0 kg', 'goal': 'Recomp/Halten',
    'tempo': 'Gewicht halten (±0,2 kg/Woche)', 'goal_text': 'Straffer und fitter werden, Gewicht ungefähr halten.',
    'facts': 'Teilzeit im Büro, 2 Kinder · Gym-Anfängerin (seit 2 Monaten), trainiert an Maschinen · Garmin-Uhr · trackt mit Yazio · '
             'Kreatin, Omega-3, Magnesium · wird in der 2. Woche krank (Erkältung)',
    'supp_legend': 'K = Kreatin, O = Omega-3, M = Magnesium',
    'legend': 'Gewicht schwankt durch Sushi, Familienfeier und Krankheit · grau = erst am nächsten Tag über 📅 nachtragen · gelb = Tippfehler-Test · '
              'Tag 8–10: Pause wegen Erkältung (siehe „Besonderes“).',
    'days': [
        (1, '64,0', 1780, 112, 200, 60, '10.400', 450, '7,0', 4, 4, 4, 63, 44, 'K O M', 'Kraft A', 'Start: Umfänge + Foto', ''),
        (2, '64,6', 1850, 108, 215, 62, '8.900', 390, '6,5', 3, 4, 3, 64, 42, 'K O M', '–', '+0,6 kg: gestern Sushi mit viel Sojasoße', ''),
        (3, '64,1', 1760, 118, 195, 58, '11.300', 480, '7,0', 4, 4, 4, 63, 45, 'K O M', 'Kraft B', '', ''),
        (4, '63,7', 1690, 105, 190, 57, '12.600', 520, '7,5', 4, 5, 4, 62, 47, 'K O M', 'Spazieren 60 min · 5,2 km · locker', 'Termin anfragen', ''),
        (5, '64,2', 1810, 116, 205, 61, '9.700', 420, '7,0', 4, 4, 4, 63, 44, 'K O M', 'Kraft A', '', ''),
        (6, '65,1', 2250, 95, 260, 85, '7.800', 360, '6,0', 3, 3, 3, 65, 40, 'O M', '–', 'Familienfeier, Kuchen · Kreatin vergessen', ''),
        (7, '64,7', 1780, 114, 198, 60, '10.100', 440, '7,5', 4, 4, 4, 63, 44, 'K O M', 'Zumba-Kurs 50 min · Intervall', 'Check-in 1 · Art „Kurs“', ''),
        (8, '64,3', 1500, 80, 190, 50, '4.200', 180, '9,0', 3, 2, 1, 70, 31, '–', '–', 'Erkältung: Heute → „Ich kann gerade nicht trainieren“ → krank · Push 1 Tag stumm', ''),
        (9, '63,9', 1450, 75, 185, 48, '3.100', 120, '9,5', 3, 2, 2, 69, 33, 'O', '–', 'noch krank', ''),
        (10, '63,8', 1700, 110, 192, 57, '6.800', 300, '8,0', 4, 3, 3, 66, 38, 'K O M', '–', 'Heute → „Ich bin wieder fit“ tippen', ''),
        (11, '64,2', 1790, 117, 199, 60, '10.900', 460, '7,5', 4, 4, 4, 64, 43, 'K O M', 'Kraft B', 'erstes Training nach der Pause', ''),
        (12, '64,8', 1880, 112, 215, 63, '9.500', 410, '7,0', 4, 4, 4, 63, 44, 'K O M', '–', 'erst an Tag 13 über 📅 nachtragen', 'grey'),
        (13, '6,41 → 64,1', 1760, 118, 196, 59, '11.500', 470, '7,5', 4, 5, 4, 62, 46, 'K O M', 'Kraft A', 'Tippfehler beim Gewicht', 'amber'),
        (14, '63,9', 1800, 120, 200, 60, '12.200', 500, '7,5', 5, 5, 4, 62, 47, 'K O M', '–', 'Ende: Umfänge + Foto · Check-in 2', ''),
    ],
    'train_lead': 'Maschinen-Training. „Hilfe 30“ = 30 kg Unterstützung (weniger Hilfe = stärker). Zeit-Übungen in Sekunden.',
    'workouts': [
        (1, 'A', '', [
            ('Beinpresse', '60×12 · 60×12 · 60×11'),
            ('Brustpresse Maschine', '20×12 · 20×11 · 20×10'),
            ('Klimmzug mit Unterstützung', 'Hilfe 30×8 · Hilfe 30×7 · Hilfe 30×6'),
            ('Hip Thrust Maschine', '40×12 · 40×12 · 40×12'),
            ('Plank', '30 s · 30 s · 25 s'),
        ]),
        (3, 'B', '', [
            ('Latzug Maschine', '30×12 · 30×11 · 30×10'),
            ('Schulterpresse Maschine', '15×12 · 15×10 · 15×9'),
            ('Beinbeuger sitzend', '25×12 · 25×12 · 25×11'),
            ('Beinstrecker', '25×12 · 25×12 · 25×12'),
            ('Rudermaschine (brustgestützt)', '25×12 · 25×12 · 25×11'),
        ]),
        (5, 'A', '', [
            ('Beinpresse', '60×12 · 60×12 · 60×12'),
            ('Brustpresse Maschine', '20×12 · 20×12 · 20×11'),
            ('Klimmzug mit Unterstützung', 'Hilfe 30×8 · Hilfe 30×8 · Hilfe 30×7'),
            ('Hip Thrust Maschine', '45×12 🏅 · 45×12 · 45×11'),
            ('Plank', '35 s · 30 s · 30 s'),
        ]),
        (11, 'B', 'Erstes Training nach der Erkältung – etwas leichter', [
            ('Latzug Maschine', '27,5×12 · 27,5×12 · 27,5×12'),
            ('Schulterpresse Maschine', '12,5×12 · 12,5×12 · 12,5×11'),
            ('Beinbeuger sitzend', '25×12 · 25×12 · 25×12'),
            ('Beinstrecker', '27,5×12 🏅 · 27,5×11 · 27,5×10'),
            ('Rudermaschine (brustgestützt)', '25×12 · 25×12 · 25×12'),
        ]),
        (13, 'A', '', [
            ('Beinpresse', '65×12 🏅 · 65×12 · 65×11'),
            ('Brustpresse Maschine', '22,5×12 · 22,5×11 · 22,5×10'),
            ('Klimmzug mit Unterstützung', 'Hilfe 27,5×8 🏅 · Hilfe 27,5×7 · Hilfe 27,5×7'),
            ('Hip Thrust Maschine', '45×12 · 45×12 · 45×12'),
            ('Plank', '40 s · 35 s · 35 s'),
        ]),
    ],
    'measure': [('Taille', '74,0', '73,0'), ('Hüfte', '99,0', '98,5'), ('Brust', '90,0', '90,0'), ('Oberarm', '27,5', '27,5'), ('Oberschenkel', '56,0', '55,5')],
    'checkins': [
        (7, 'gut', 'normal', 'hoch', 'okay', 'Stressige Woche mit den Kindern, Familienfeier.'),
        (14, 'okay', 'normal', 'mittel', 'gut', 'Erkältung hat mich zurückgeworfen, aber Training danach ging gut.'),
    ],
    'request': 'Tag 4: Profil → „Termin anfragen“ → Sonstiges: „Frage zu Supplementen, gern als Call, Mo–Fr 12–13 Uhr.“',
    'checks': [
        ['Login, eigenes Passwort, Einführung', 'Homescreen + Push erlauben', 'Ringe: Kalorien, Protein, Schritte', '„Ich kann gerade nicht trainieren“ → krank (Tag 8)',
         'Push 1 Tag stumm schalten (Tag 8)', '„Ich bin wieder fit“ (Tag 10)', 'Tippfehler + Nachtragen'],
        ['Maschinen mit Hilfe-Gewicht (Klimmzug)', 'Zeit-Übung Plank', '🏅 bei Rekord (Tag 5, 11, 13)', 'Kurs „Zumba“ unter Cardio-Arten', 'Satz abhaken → grün',
         'Pausentimer', '„Vorher“ antippen'],
        ['Gewichtsgrafik: Pause-Tage sind markiert', 'Uhr-Werte: Ruhepuls steigt bei Krankheit', 'Foto + Umfänge-Vergleich', 'Supplemente abhaken',
         'Check-in, Antwort von Max', 'Terminanfrage, Antwort sehen', 'Abmelden und wieder anmelden'],
    ],
    'setup': {
        'create': 'Einwilligung = heute',
        'modules': 'Krafttraining, Cardio, Körpergewicht, Ernährung, Aktivität, Schlaf, Motivation & Befinden, Uhr-Werte, Supplemente, Erfolge',
        'unlocks': 'Fotos & Umfänge',
        'consents': 'Fortschrittsfotos: Einwilligungs-Datum = Tag der Einrichtung',
        'calc': 'Rechner: weiblich, 41, 165 cm, 64,0 kg, „Leicht aktiv“, 0 kg/Woche, Protein 1,8 g/kg, Fett 0,9 g/kg → ca. 1.790 kcal · 115 g P · 58 g F · 202 g KH → „Als Ziele übernehmen“',
        'targets': 'Schritte 10.000 · Schlaf 7,5 h · Gewicht: Ziel-Tempo 0 · Cardio 60 min/Woche',
        'plan': 'Vorlage „Maschinen-Einstieg A/B (Test)“, 3 Einheiten/Woche, 6 Wochen. A: Beinpresse 3×10–12, Brustpresse 3×10–12, Klimmzug mit Unterstützung 3×6–8, '
                'Hip Thrust Maschine 3×12, Plank 3×30 s. B: Latzug Maschine 3×10–12, Schulterpresse Maschine 3×10–12, Beinbeuger sitzend 3×12, Beinstrecker 3×12, '
                'Rudermaschine (brustgestützt) 3×12. RIR 2, Pause 90 s.',
        'supps': 'Kreatin 3 g (täglich), Omega-3 (täglich), Magnesium (abends)',
        'other': 'Check-in-Tag = Wochentag von Tag 7 · Tag 8: Pausen-Meldung im Dashboard sehen, Tag 10: Status wieder auf „aktiv“ setzen',
    },
}

NOAH = {
    'n': 5, 'username': 'test.noah', 'first': 'Noah', 'last': 'Fischer (Test)', 'sex': 'männlich',
    'birth': '18.08.2010', 'age': 16, 'height': 175, 'start_weight': '–', 'goal': 'Allgemeine Fitness',
    'tempo': 'kein Gewichtsziel', 'goal_text': 'Fitter und stärker für den Fußball werden, sauber trainieren lernen.',
    'facts': 'Schüler (11. Klasse) · Fußball im Verein: 2× Training + 1 Spiel pro Woche · Krafttraining-Anfänger · Handy zählt Schritte, keine Uhr · '
             'keine Supplemente · minderjährig: Eltern haben eingewilligt',
    'supp_legend': None,
    'legend': 'Als Jugendlicher trägst du kein Gewicht und keine Kalorien ein (bei dir bewusst aus) · gelb = Tippfehler-Test · '
              'grau = erst am nächsten Tag über 📅 nachtragen · – = für dich nicht aktiv.',
    'days': [
        (1, '–', '–', '–', '–', '–', '9.500', '–', '8,5', 4, 5, 5, '–', '–', '–', 'Kraft A', 'Start', ''),
        (2, '–', '–', '–', '–', '–', '11.200', '–', '9,0', 4, 4, 4, '–', '–', '–', 'Fußball 90 min · Intervall · Anstr. 7', 'Cardio-Art „Fußball“ unter „Weitere“', ''),
        (3, '–', '–', '–', '–', '–', '8.100', '–', '8,0', 4, 4, 4, '–', '–', '–', '–', '', ''),
        (4, '–', '–', '–', '–', '–', '12.400', '–', '8,5', 5, 5, 5, '–', '–', '–', 'Fußball 90 min · Intervall · Anstr. 7', '', ''),
        (5, '–', '–', '–', '–', '–', '7.900', '–', '7,5', 3, 4, 3, '–', '–', '–', 'Kraft B', '', ''),
        (6, '–', '–', '–', '–', '–', '15.800', '–', '9,5', 5, 5, 5, '–', '–', '–', 'Fußball (Spiel) 80 min · Anstr. 9', '', ''),
        (7, '–', '–', '–', '–', '–', '6.200', '–', '10,0', 4, 3, 3, '–', '–', '–', '–', 'Check-in 1', ''),
        (8, '–', '–', '–', '–', '–', '93.000 → 9.300', '–', '8,0', 4, 4, 4, '–', '–', '–', 'Seilspringen 15 min · HIIT', 'Tippfehler bei Schritten', 'amber'),
        (9, '–', '–', '–', '–', '–', '11.000', '–', '7,0', 3, 3, 3, '–', '–', '–', 'Fußball 90 min · Intervall · Anstr. 7', 'Termin anfragen', ''),
        (10, '–', '–', '–', '–', '–', '8.400', '–', '8,5', 4, 4, 4, '–', '–', '–', 'Kraft A', '', ''),
        (11, '–', '–', '–', '–', '–', '10.900', '–', '6,0', 2, 2, 2, '–', '–', '–', 'Fußball 90 min · Intervall · Anstr. 6', 'Klausurwoche, wenig Schlaf', ''),
        (12, '–', '–', '–', '–', '–', '7.100', '–', '6,5', 3, 2, 2, '–', '–', '–', '–', 'Motivation 2 – 3 Tage am Stück · erst an Tag 13 nachtragen', 'grey'),
        (13, '–', '–', '–', '–', '–', '16.200', '–', '9,0', 5, 2, 4, '–', '–', '–', 'Fußball (Spiel) 80 min · Anstr. 9', '', ''),
        (14, '–', '–', '–', '–', '–', '6.900', '–', '9,5', 4, 4, 4, '–', '–', '–', 'Kraft B', 'Check-in 2', ''),
    ],
    'train_lead': 'Körpergewicht + Maschinen. „+0“ = ohne Zusatzgewicht, „Hilfe 35“ = 35 kg Unterstützung. L/R = je Seite.',
    'workouts': [
        (1, 'A', '', [
            ('Liegestütz', '15 · 12 · 10 Wiederholungen'),
            ('Klimmzug mit Unterstützung', 'Hilfe 35×8 · Hilfe 35×7 · Hilfe 35×6'),
            ('Goblet Squat', '12×12 · 12×12 · 12×10'),
            ('Glute Bridge', '+0×15 · +0×15 · +0×15'),
            ('Plank', '40 s · 40 s · 35 s'),
        ]),
        (5, 'B', '', [
            ('Beinpresse', '80×12 · 80×12 · 80×11'),
            ('Latzug breit', '35×12 · 35×11 · 35×10'),
            ('Brustpresse Maschine', '30×12 · 30×11 · 30×10'),
            ('Ausfallschritte (Walking Lunges)', '3 Sätze je Seite: L 6×10 · R 6×10'),
            ('Dead Bug', '10 · 10 · 10 Wiederholungen'),
        ]),
        (10, 'A', '', [
            ('Liegestütz', '17 🏅 · 14 · 12 Wiederholungen'),
            ('Klimmzug mit Unterstützung', 'Hilfe 32,5×8 🏅 · Hilfe 32,5×7 · Hilfe 32,5×7'),
            ('Goblet Squat', '14×12 🏅 · 14×11 · 14×10'),
            ('Glute Bridge', '+5×15 · +5×15 · +5×15'),
            ('Plank', '45 s · 45 s · 40 s'),
        ]),
        (14, 'B', '', [
            ('Beinpresse', '85×12 🏅 · 85×12 · 85×11'),
            ('Latzug breit', '37,5×12 · 37,5×11 · 37,5×10'),
            ('Brustpresse Maschine', '32,5×12 · 32,5×11 · 32,5×10'),
            ('Ausfallschritte (Walking Lunges)', '3 Sätze je Seite: L 8×10 · R 8×10'),
            ('Dead Bug', '12 · 12 · 12 Wiederholungen'),
        ]),
    ],
    'measure': [],
    'checkins': [
        (7, 'sehr gut', 'viel', 'wenig', 'gut', 'Spiel gewonnen, Muskelkater nach Kraft B.'),
        (14, 'okay', 'normal', 'hoch', 'okay', 'Klausuren, wenig Schlaf, Motivation war unten.'),
    ],
    'request': 'Tag 9: Profil → „Termin anfragen“ → Online-Call: „Call mit mir und meiner Mutter zum Trainingsplan, Samstag 10 Uhr.“',
    'checks': [
        ['Login, eigenes Passwort, Einführung', 'Homescreen + Push erlauben', 'Kein Gewicht/keine Kalorien im Abend-Check', 'Tippfehler bei Schritten (Tag 8)',
         'Nachtragen über 📅 (Tag 13)', 'Schlaf + Motivation eintragen', 'Ringe: Schritte + Woche'],
        ['Liegestütz (nur Wiederholungen)', 'Klimmzug mit Hilfe-Gewicht', 'Glute Bridge mit „+0“ bzw. „+5“', 'L/R bei Ausfallschritten', '🏅 bei Rekord (Tag 10, 14)',
         'Cardio: Fußball, Seilspringen', 'Pausentimer'],
        ['Löwe bei Erfolgen, Erfolge-Seite', 'Auswertung: Schlaf, Motivation, Training pro Woche', 'Check-in, Antwort von Max', 'Terminanfrage, Antwort sehen',
         'Hilfe & FAQ lesen', 'Farbmodus wechseln', 'Abmelden und wieder anmelden'],
    ],
    'setup': {
        'create': 'Geburtsdatum → minderjährig: Eltern-Einwilligung mit Datum Pflicht (für den Test: fiktive Einwilligung, Datum = heute)',
        'modules': 'Krafttraining, Cardio, Aktivität, Schlaf, Motivation & Befinden, Erfolge (Ernährung, Körpergewicht, Supplemente bewusst aus – Jugendlicher)',
        'unlocks': '–',
        'consents': '–',
        'calc': '– (Ernährung nicht aktiv) · optional selbst testen: Rechner mit 16 Jahren zeigt die Minderjährigen-Warnung',
        'targets': 'Schritte 9.000 · Schlaf 9 h · Cardio 240 min/Woche (Fußball)',
        'plan': 'Vorlage „Jugend-Einstieg A/B (Test)“, 2 Einheiten/Woche. A: Liegestütz 3×max, Klimmzug mit Unterstützung 3×6–8, Goblet Squat 3×10–12, Glute Bridge 3×15, Plank 3×40 s. '
                'B: Beinpresse 3×10–12, Latzug breit 3×10–12, Brustpresse 3×10–12, Ausfallschritte (Walking Lunges) 3×10, Dead Bug 3×10. RIR 3, Pause 90 s.',
        'supps': '– (keine)',
        'other': 'Check-in-Tag = Wochentag von Tag 7 · Nach dem Test: Eltern-Bericht erstellen und als PDF drucken (Werkzeug „Eltern-Bericht“)',
    },
}

PERSONAS = [LENA, JONAS, TOM, ANNA, NOAH]
