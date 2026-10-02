"""Generates the pilot test-person PDFs (HTML -> PDF with headless Edge).

Run:  python docs/testzugaenge/generate.py
Out:  docs/testzugaenge/Testzugang-<n>-<name>.pdf  (for the tester, 4 pages)
      docs/testzugaenge/Einrichtung-Testzugaenge.pdf (only for Max)

All persona data is fictional. Start passwords are never written into these files.
"""
import html
import os
import subprocess
import time

HERE = os.path.dirname(os.path.abspath(__file__))
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
E = html.escape

# ---------------------------------------------------------------------------
# Personas
# ---------------------------------------------------------------------------
PERSONAS = [
    {
        'n': 1, 'username': 'test.lena', 'first': 'Lena', 'last': 'Becker (Test)', 'sex': 'weiblich',
        'birth': '14.03.2002', 'age': 24, 'height': 168, 'start_weight': '72,4', 'goal': 'Fettabbau (Cut)',
        'tempo': '−0,5 kg pro Woche', 'goal_text': 'Bis zum Sommer 6 kg Fett verlieren und dabei die Kraft halten.',
        'facts': 'Bürojob · seit 1 Jahr im Gym (3× Ganzkörper) · wandert gern · trackt mit Yazio · Apple Watch · '
                 'Kreatin, Vitamin D3, Whey · Zyklus ca. 29 Tage · linkes Knie zwickt manchmal',
        # Tag | Gewicht | kcal | P | KH | F | Schritte | akt kcal | Schlaf h | Qual | Mot | Energie | Ruhepuls | HRV | Supplemente | Training | Besonderes | style
        'days': [
            (1, '72,4', 1720, 128, 165, 58, '8.400', 420, '7,5', 4, 4, 4, 62, 48, 'K D W', 'Kraft A', 'Start: Umfänge + Foto', ''),
            (2, '72,1', 1810, 135, 180, 57, '6.200', 380, '6,5', 3, 4, 3, 63, 45, 'K D', 'Laufband 25 min · 3,2 km · locker', '', ''),
            (3, '72,3', 1690, 122, 160, 60, '9.100', 470, '7,0', 4, 4, 4, 61, 50, 'K D W', 'Kraft B', '', ''),
            (4, '71,9', 2150, 110, 240, 78, '11.800', 610, '8,5', 5, 5, 4, 60, 52, '–', 'Spazieren 45 min · 4,0 km · locker', 'Supplemente vergessen', ''),
            (5, '71,8', 1760, 131, 170, 58, '7.600', 400, '7,0', 3, 4, 3, 62, 47, 'K D W', 'Kraft A', '', ''),
            (6, '72,5', 1980, 118, 210, 72, '5.200', 290, '6,0', 2, 2, 2, 66, 40, 'K D', '–', 'Periode beginnt', 'pink'),
            (7, '72,9', 1850, 125, 190, 66, '6.900', 350, '7,5', 3, 2, 2, 65, 41, 'K D', 'Indoor-Cycling 30 min · Intervall', 'Periode · Check-in 1', 'pink'),
            (8, '72,7', 1700, 133, 158, 59, '8.800', 450, '7,0', 3, 2, 3, 64, 43, 'K D W', 'Kraft B', 'Periode · Knie melden', 'pink'),
            (9, '7,21 → 72,1', 1740, 129, 168, 60, '9.400', 480, '7,5', 4, 3, 3, 62, 47, '–', '–', 'Tippfehler-Warnung ansehen · Termin anfragen', 'pink'),
            (10, '71,8', 1680, 136, 152, 57, '8.100', 430, '7,0', 4, 4, 4, 61, 49, 'K D W', 'Kraft A (anderes Gym)', 'Periode endet', 'pink'),
            (11, '71,6', 2300, 105, 260, 82, '21.500', 1150, '8,0', 5, 5, 4, 60, 53, 'K D', 'Wandern 120 min · 9,0 km · lang', '', ''),
            (12, '71,7', 1720, 132, 162, 58, '7.300', 380, '6,5', 3, 4, 3, 62, 46, 'K D', '–', 'erst an Tag 13 über 📅 nachtragen', 'grey'),
            (13, '71,3', 1750, 134, 166, 59, '7.900', 410, '7,0', 4, 4, 4, 61, 50, 'K D W', 'Kraft B + KM Pacer 3 km', '', ''),
            (14, '71,2', 1690, 130, 158, 58, '8.600', 440, '7,5', 4, 5, 4, 60, 52, 'K D', '–', 'Ende: Umfänge + Foto · Check-in 2', ''),
        ],
        # training days: (Tag, Einheit, note, [(Übung, Sätze), …])  Sätze: W = Aufwärmsatz, 🏅 = neuer Rekord
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
            (7, 'gut', 'viel', 'mittel', 'okay', 'Heißhunger auf Süßes in der Periode, Knie zwickt.'),
            (14, 'sehr gut', 'normal', 'wenig', 'gut', 'Wandertag war super, Gewicht geht runter.'),
        ],
        'cycle': 'Tag 6 „Periode hat begonnen“, Tag 10 „Periode ist zu Ende“ (beides im Abend-Check). An Tag 6–9 steht unter dem Gewicht ein rosa Hinweis.',
        'request': 'Tag 9: Profil → „Termin anfragen“ → Online-Call: „Kurzer Call wegen meinem Knie, am liebsten Do oder Fr ab 18 Uhr.“',
        'setup': {
            'modules': 'Krafttraining, Cardio, Körpergewicht, Ernährung, Aktivität, Schlaf, Motivation & Befinden, Uhr-Werte, Supplemente, Zyklus, Erfolge',
            'unlocks': 'Fotos & Umfänge, Freies Training (beim Krafttraining unter „Freigaben“)',
            'consents': 'Zyklus und Fortschrittsfotos: Einwilligungs-Datum = Tag der Einrichtung',
            'calc': 'Rechner: weiblich, 24, 168 cm, 72,4 kg, „Mäßig aktiv“, −0,5 kg/Woche, Protein 2,0 g/kg, Fett 0,8 g/kg → ca. 1.760 kcal · 145 g P · 58 g F · 165 g KH → „Als Ziele übernehmen“',
            'targets': 'Schritte 8.000 · Schlaf 7,5 h · Cardio 90 min/Woche (Vorgabe: Di Laufband 25 min locker, Sa Wandern 60 min)',
            'plan': 'Neue Vorlage „Ganzkörper A/B (Test)“, 3 Einheiten/Woche, 6 Wochen, Deload in Woche 6. '
                    'A: Kniebeuge 3×8–10 (1 Aufw.), KH-Bankdrücken 3×8–12, Latzug V-Griff 3×10–12, Hip Thrust 3×10–12, Plank 3×45 s. '
                    'B: Rum. Kreuzheben 3×8–10 (1 Aufw.), KH-Schulterdrücken sitzend 3×10–12, Kabelrudern breiter Griff 3×10–12, '
                    'Ausfallschritte rückwärts 3×10, Seitheben KH 3×12–15 + Trizepsdrücken Seil 3×12–15 (Supersatz „A“). RIR 2, Pause 120 s.',
            'supps': 'Kreatin 5 g (täglich), Vitamin D3 (täglich), Whey (Trainingstage)',
            'checkin': 'Check-in-Tag: der Wochentag von Tag 7 (wenn Lena montags startet: Sonntag)',
        },
    },
]

# ---------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------
CSS = """
@page { size: A4; margin: 12mm 0 12mm; }
@page :first { margin-top: 0; }
@page wide { size: A4 landscape; margin: 10mm 0 10mm; }
:root { --navy:#111827; --blue:#2563eb; --blue-soft:#eef3fe; --line:#dbe3ef; --field:#f3f6fb; --ink:#1f2937; --muted:#6b7280; --pink:#db2777; --pink-soft:#fdf0f6; --amber:#b45309; --amber-soft:#fdf4e3; --grey:#eef0f3; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: Lato, "Segoe UI", Arial, sans-serif; color: var(--ink); font-size: 8.8pt; line-height: 1.34; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.wrap { padding: 0 13mm; }
.band { background: var(--navy); color: #fff; padding: 6.5mm 13mm 4.5mm; border-bottom: 2mm solid var(--blue); }
.band .top { display: flex; justify-content: space-between; font-size: 8pt; margin-bottom: 4mm; }
.band .top b { font-weight: 900; letter-spacing: .04em; } .band .top span { color: #60a5fa; font-weight: 700; margin-left: 8px; letter-spacing: .06em; }
.band h1 { font-size: 20pt; font-weight: 900; margin: 0 0 1mm; }
.band p { margin: 0; color: #cbd5e1; font-size: 9.5pt; }
h2 { display: flex; align-items: center; gap: 2.5mm; font-size: 11.5pt; font-weight: 900; margin: 4mm 0 1.8mm; break-after: avoid; }
h2 .n { width: 6mm; height: 6mm; border-radius: 1.3mm; background: var(--blue); color: #fff; font-size: 9pt; display: inline-flex; align-items: center; justify-content: center; flex: none; }
p { margin: 1mm 0; }
.lead { color: var(--muted); margin: -.5mm 0 2mm; }
.box { border-radius: 2mm; padding: 2.6mm 3.6mm; margin: 3mm 0 2mm; }
.box.blue { background: var(--blue-soft); border-left: 3px solid var(--blue); }
.box.amber { background: var(--amber-soft); border-left: 3px solid #f59e0b; }
.access { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; margin: 3mm 0; }
.access div { background: var(--field); border: 1px solid var(--line); border-radius: 2mm; padding: 2.5mm 3mm; }
.access small { display: block; color: var(--muted); font-size: 7.4pt; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
.access strong { font-size: 11.5pt; font-family: Consolas, monospace; }
.access .pw { border-bottom: 1px solid #9aa6b8; height: 5.5mm; }
.kv { display: grid; grid-template-columns: 26mm 1fr 26mm 1fr; gap: 1.2mm 3mm; }
.kv div:nth-child(odd) { color: var(--muted); font-weight: 700; font-size: 8.2pt; }
table { width: 100%; border-collapse: collapse; font-size: 8.4pt; }
th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); font-weight: 700; padding: 1.1mm 1.3mm; border-bottom: 1.5px solid var(--navy); vertical-align: bottom; }
td { padding: 1.1mm 1.3mm; border-bottom: 1px solid var(--line); vertical-align: top; }
tr { break-inside: avoid; }
.c { text-align: center; }
tr.pink td { background: var(--pink-soft); }
tr.grey td { background: var(--grey); }
.note { color: var(--muted); font-size: 7.8pt; }
ul.check { list-style: none; margin: 0; padding: 0; }
ul.check li { position: relative; padding-left: 4.6mm; margin: .6mm 0; break-inside: avoid; }
ul.check li::before { content: ""; position: absolute; left: 0; top: 1mm; width: 2.4mm; height: 2.4mm; border: 1.2px solid var(--blue); border-radius: .5mm; background: #fff; }
.page { break-before: page; }
.wide { page: wide; break-before: page; padding: 0 10mm; }
.wide table { font-size: 8.2pt; }
.wide td, .wide th { padding: 1.2mm 1.1mm; }
.runhead { display: flex; justify-content: space-between; font-size: 7.6pt; border-bottom: 1px solid var(--line); padding-bottom: 1.6mm; margin: 0 0 3mm; }
.runhead b { font-weight: 900; } .runhead span { color: var(--blue); margin-left: 6px; }
.days { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.day { border: 1px solid var(--line); border-radius: 2mm; overflow: hidden; break-inside: avoid; }
.day-head { background: var(--navy); color: #fff; padding: 1.6mm 2.6mm; display: flex; justify-content: space-between; font-weight: 700; }
.day-head span { color: #93c5fd; font-weight: 400; }
.day table td { border-bottom: 1px solid var(--line); font-size: 8.2pt; }
.day table td:first-child { width: 38%; font-weight: 700; }
.day .dnote { padding: 1.4mm 2.6mm; background: var(--amber-soft); font-size: 7.8pt; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; }
.mini h3 { font-size: 9pt; margin: 0 0 1mm; font-weight: 900; }
.fill { border-bottom: 1px solid #9aa6b8; height: 5mm; }
.fb { display: grid; grid-template-columns: 58mm 1fr; gap: 2mm 3mm; }
"""

HEAD = '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>{title}</title>' \
       '<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet"><style>' + CSS + '</style></head><body>'


def band(title, sub):
    return f'''<header class="band"><div class="top"><div><b>MAX REINERT</b><span>PILOTPHASE · TESTZUGANG</span></div><div>@mx.sports10</div></div>
<h1>{E(title)}</h1><p>{E(sub)}</p></header>'''


def runhead(text):
    return f'<div class="runhead"><div><b>MAX REINERT</b><span>{E(text)}</span></div><div>app.mxreinert.de</div></div>'


def tester_html(p):
    name = p['first']
    day_rows = ''
    for d in p['days']:
        cells = ''.join(f'<td class="c">{E(str(v))}</td>' for v in d[1:15])
        day_rows += f'<tr class="{d[17]}"><td class="c"><b>{d[0]}</b></td>{cells}<td>{E(d[15])}</td><td>{E(d[16])}</td></tr>'

    workouts = ''
    for tag, unit, note, exs in p['workouts']:
        rows = ''.join(f'<tr><td>{E(x)}</td><td>{E(s)}</td></tr>' for x, s in exs)
        workouts += f'''<div class="day"><div class="day-head">Tag {tag} · Einheit {unit}<span>kg × Wiederholungen</span></div>
<table>{rows}</table>{f'<div class="dnote">{E(note)}</div>' if note else ''}</div>'''

    meas = ''.join(f'<tr><td>{E(m[0])}</td><td class="c">{m[1]}</td><td class="c">{m[2]}</td></tr>' for m in p['measure'])
    ci = ''.join(f'<tr><td class="c"><b>{c[0]}</b></td><td>{E(c[1])}</td><td>{E(c[2])}</td><td>{E(c[3])}</td><td>{E(c[4])}</td></tr><tr><td></td><td colspan="4" class="note">Schwierig: {E(c[5])}</td></tr>' for c in p['checkins'])

    return HEAD.replace('{title}', f'Testzugang {p["n"]} – {name}') + band(f'Testzugang {p["n"]}: {name} (fiktiv)', '14 Tage die mxCoaching-App testen – mit einer erfundenen Person, nicht mit deinen eigenen Daten.') + f'''
<main class="wrap">
  <div class="access">
    <div><small>App</small><strong>app.mxreinert.de</strong></div>
    <div><small>Benutzername</small><strong>{E(p["username"])}</strong></div>
    <div><small>Startpasswort (von Max)</small><div class="pw"></div></div>
  </div>

  <div class="box amber"><b>Wichtig:</b> Trag <b>nur die Werte aus dieser PDF</b> ein – nie deine eigenen Gesundheitsdaten. Beim Fortschrittsfoto <b>keine Fotos von dir</b> (z. B. eine Wasserflasche fotografieren).
  Beim ersten Login setzt du ein eigenes Passwort. Danach: App zum Homescreen hinzufügen (iPhone: Safari → Teilen → „Zum Home-Bildschirm“) und Push erlauben. <b>Tag 1</b> = der Tag, an dem du startest.</div>

  <h2><span class="n">1</span>Du bist {E(name)}</h2>
  <div class="kv">
    <div>Name</div><div>{E(p["first"])} {E(p["last"])}</div><div>Größe</div><div>{p["height"]} cm</div>
    <div>Geboren</div><div>{E(p["birth"])} ({p["age"]} J.), {E(p["sex"])}</div><div>Startgewicht</div><div>{p["start_weight"]} kg</div>
    <div>Ziel</div><div><b>{E(p["goal"])}</b>, {E(p["tempo"])}</div><div>Warum</div><div>{E(p["goal_text"])}</div>
  </div>
  <p class="note" style="margin-top:1.5mm">{E(p["facts"])}</p>

  <h2><span class="n">2</span>So gehst du jeden Tag vor (3–5 Minuten)</h2>
  <ul class="check">
    <li><b>Morgens:</b> Gewicht aus Seite 2 eintragen.</li>
    <li><b>Abends:</b> Abend-Check („Eintragen“) mit allen Werten der Zeile des Tages, Supplemente abhaken (K = Kreatin, D = Vitamin D3, W = Whey).</li>
    <li><b>Krafttraining:</b> genau die Sätze von Seite 3 eintragen. „W“ = Aufwärmsatz (Satznummer antippen → Aufwärmsatz), 🏅 = da sollte ein Rekord erscheinen. Bei jedem Satz RIR 2, beim letzten RIR 1.</li>
    <li><b>Cardio:</b> unter Training → Cardio eintragen, Art aus der Liste wählen.</li>
    <li><b>Spalte „Besonderes“</b> beachten – dort stehen die Test-Aufgaben des Tages.</li>
  </ul>

  <h2><span class="n">3</span>Extras</h2>
  <div class="grid3">
    <div class="mini"><h3>Zyklus</h3><p>{E(p["cycle"])}</p></div>
    <div class="mini"><h3>Umfänge in cm (Tag 1 → Tag 14)</h3><table>{meas}</table></div>
    <div class="mini"><h3>Termin anfragen</h3><p>{E(p["request"])}</p></div>
  </div>
  <h3 style="font-size:9pt;margin:3mm 0 1mm;font-weight:900">Check-in-Antworten</h3>
  <table><tr><th class="c">Tag</th><th>Woche war</th><th>Hunger</th><th>Stress</th><th>Erholung</th></tr>{ci}</table>
</main>

<main class="wide">
  {runhead(f"Testzugang {p['n']} · {name} · Jeder Tag auf einen Blick")}
  <h2><span class="n">4</span>Tageswerte – eine Zeile pro Tag</h2>
  <p class="lead">Rosa = Periode · grau = an diesem Tag nichts eintragen, erst am nächsten Tag über 📅 nachtragen · „7,21 → 72,1“ = erst den Tippfehler eintragen, Warnung ansehen, dann korrigieren.</p>
  <table>
    <thead><tr><th class="c">Tag</th><th class="c">Gewicht kg</th><th class="c">kcal</th><th class="c">Protein g</th><th class="c">KH g</th><th class="c">Fett g</th>
      <th class="c">Schritte</th><th class="c">Aktive kcal</th><th class="c">Schlaf h</th><th class="c">Schlaf­qualität</th><th class="c">Moti­vation</th><th class="c">Energie</th>
      <th class="c">Ruhe­puls</th><th class="c">HRV ms</th><th class="c">Supple­mente</th><th>Training / Cardio</th><th>Besonderes</th></tr></thead>
    <tbody>{day_rows}</tbody>
  </table>
</main>

<main class="wrap page">
  {runhead(f"Testzugang {p['n']} · {name} · Krafttraining Satz für Satz")}
  <h2><span class="n">5</span>Krafttraining – jeder Satz</h2>
  <p class="lead">Den Plan legt Max an. Trag die Sätze genau so ein. Format: <b>Gewicht kg × Wiederholungen</b>, Sätze durch „·“ getrennt. Supersatz: erst Seitheben, dann direkt Trizeps, dann Pause.</p>
  <div class="days">{workouts}</div>
</main>

<main class="wrap page">
  {runhead(f"Testzugang {p['n']} · {name} · Prüfen & Feedback")}
  <h2><span class="n">6</span>Darauf achten – abhaken, wenn es klappt</h2>
  <div class="grid3">
    <ul class="check">
      <li>Login, eigenes Passwort, Einführung</li><li>Homescreen + Push-Erinnerungen kommen</li><li>Ringe auf „Heute“ füllen sich</li>
      <li>Tippfehler-Warnung (Tag 9)</li><li>Nachtragen über 📅 (Tag 13)</li><li>„Nicht getrackt“ einmal testen</li>
      <li>Farbmodus im Profil wechseln</li>
    </ul>
    <ul class="check">
      <li>Satz abhaken → Zeile wird grün</li><li>„Vorher“ antippen übernimmt alte Werte</li><li>Pausentimer −15 / +15 / Überspringen</li>
      <li>Supersatz: keine Pause dazwischen</li><li>🏅 bei Rekord (Tag 8, 13)</li><li>„Anderes Gym“ (Tag 10)</li><li>Freies Training (Tag 13)</li>
    </ul>
    <ul class="check">
      <li>Löwe nach dem 1. Training und bei „3/7 Tage am Stück“</li><li>Rosa Zyklus-Hinweis beim Gewicht</li><li>Foto + Umfänge-Vergleich</li>
      <li>Check-in abgeben, Antwort von Max lesen</li><li>Terminanfrage, Antwort sehen</li><li>Auswertung: Gewicht (7-Tage-Schnitt), Kraftverlauf</li><li>Abmelden und wieder anmelden</li>
    </ul>
  </div>

  <h2><span class="n">7</span>Feedback an Max (per WhatsApp)</h2>
  <p>Wenn etwas kaputt ist: sofort <b>Screenshot + kurz, wo du warst und was du erwartet hast</b>. Am Ende:</p>
  <div class="fb">
    <div>Was hat dir am besten gefallen?</div><div class="fill"></div>
    <div>Was war umständlich oder unklar?</div><div class="fill"></div>
    <div>Was hat nicht funktioniert?</div><div class="fill"></div>
    <div>Würdest du die App selbst nutzen? (1–10)</div><div class="fill"></div>
    <div>Handy / Browser</div><div class="fill"></div>
  </div>
</main>
</body></html>'''


def setup_html(personas):
    blocks = ''
    for p in personas:
        s = p['setup']
        blocks += f'''
  <h2><span class="n">{p["n"]}</span>{E(p["first"])} {E(p["last"])} · <span style="font-family:Consolas,monospace;font-weight:700">{E(p["username"])}</span></h2>
  <div class="fb" style="grid-template-columns:34mm 1fr">
    <div class="note"><b>Kunde anlegen</b></div><div>Vorname {E(p["first"])}, Nachname {E(p["last"])}, Geburtsdatum {E(p["birth"])}, Ziel {E(p["goal"])}, Einwilligung = heute</div>
    <div class="note"><b>Login</b></div><div>Benutzername <b>{E(p["username"])}</b>, Startpasswort selbst wählen (mind. 10 Zeichen), separat per WhatsApp schicken – nie in die PDF</div>
    <div class="note"><b>Module an</b></div><div>{E(s["modules"])}</div>
    <div class="note"><b>Freischalten</b></div><div>{E(s["unlocks"])}</div>
    <div class="note"><b>Einwilligungen</b></div><div>{E(s["consents"])}</div>
    <div class="note"><b>Ernährung</b></div><div>{E(s["calc"])}</div>
    <div class="note"><b>Weitere Ziele</b></div><div>{E(s["targets"])}</div>
    <div class="note"><b>Trainingsplan</b></div><div>{E(s["plan"])}</div>
    <div class="note"><b>Supplemente</b></div><div>{E(s["supps"])}</div>
    <div class="note"><b>Konzept</b></div><div>{E(s["checkin"])}</div>
  </div>'''
    return HEAD.replace('{title}', 'Einrichtung Testzugänge') + band('Einrichtung der Testzugänge', 'Nur für Max – nicht an Testpersonen weitergeben') + f'''
<main class="wrap">
  <div class="box blue"><b>Ablauf pro Testperson:</b> Kunde anlegen → Konto mit Benutzername + Startpasswort → Module, Freischaltungen, Einwilligungen → Ernährungs-Rechner → Plan zuweisen → Supplemente → PDF schicken, Passwort separat per WhatsApp.
  Während des Tests: Check-ins beantworten, Terminanfrage beantworten, Ampel beobachten. Danach: Testkonten löschen (LAUNCH.md).</div>
  <div class="box amber"><b>Nicht testen:</b> Hevy und Personal Training. <b>Du selbst testest:</b> Abrechnung (Testpaket 0 €), Eltern-Bericht (bei minderjähriger Testperson), Kunden-Export.</div>
  {blocks}
</main></body></html>'''


def to_pdf(html_text, name):
    src = os.path.join(HERE, '_' + name + '.html')
    out = os.path.join(HERE, name + '.pdf')
    with open(src, 'w', encoding='utf-8') as f:
        f.write(html_text)
    url = 'file:///' + src.replace('\\', '/').replace(' ', '%20')
    if os.path.exists(out):
        os.remove(out)   # fail loudly if Edge does not write a new file
    profile = os.path.join(os.environ.get('TEMP', HERE), 'mx-pdf-edge')
    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000',
                    f'--user-data-dir={profile}', f'--print-to-pdf={out}', url], check=True)
    for _ in range(60):          # Edge finishes writing a few seconds after the process returns
        if os.path.exists(out) and os.path.getsize(out) > 1000:
            break
        time.sleep(0.5)
    else:
        raise RuntimeError('Edge did not write ' + out)
    time.sleep(1)
    os.remove(src)
    return out


if __name__ == '__main__':
    for p in PERSONAS:
        print(to_pdf(tester_html(p), f'Testzugang-{p["n"]}-{p["first"]}'))
    print(to_pdf(setup_html(PERSONAS), 'Einrichtung-Testzugaenge'))
