"""Generates the pilot test-person PDFs (HTML -> PDF with headless Edge).

Run:  python docs/testzugaenge/generate.py
Out:  docs/testzugaenge/Testzugang-<n>-<name>.pdf  (for the tester)
      docs/testzugaenge/Einrichtung-Testzugaenge.pdf (only for Max)

All persona data is fictional. Start passwords are never written into these files.
"""
import html
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
E = html.escape

# ---------------------------------------------------------------------------
# Personas
# ---------------------------------------------------------------------------
PERSONAS = [
    {
        'n': 1, 'username': 'test.lena', 'first': 'Lena', 'last': 'Becker (Test)', 'sex': 'weiblich', 'sex_key': 'w',
        'birth': '14.03.2002', 'age': 24, 'height': 168, 'start_weight': '72,4', 'goal': 'Fettabbau (Cut)',
        'goal_text': 'Bis zum Sommer 6 kg Fett verlieren, dabei Kraft halten.',
        'tempo': '−0,5 kg pro Woche',
        'facts': [
            ('Alltag', 'Bürojob, viel Sitzen, ca. 7.000 Schritte am Tag'),
            ('Training', 'seit 1 Jahr im Gym, 3× pro Woche Ganzkörper'),
            ('Ausdauer', 'geht gern wandern, läuft locker auf dem Laufband'),
            ('Ernährung', 'trackt mit Yazio, isst gern abends Süßes'),
            ('Uhr', 'Apple Watch (Schritte, aktive kcal, Schlaf, Ruhepuls, HRV)'),
            ('Supplemente', 'Kreatin 5 g, Vitamin D3, Whey-Protein an Trainingstagen'),
            ('Zyklus', 'regelmäßig, ca. 29 Tage, Periode ca. 5 Tage'),
            ('Besonderheit', 'leichtes Ziehen im linken Knie bei tiefen Kniebeugen'),
        ],
        # Tag, Gewicht, kcal, Protein, KH, Fett, Besonderes
        'food': [
            (1, '72,4', 1720, 128, 165, 58, 'Start – Umfänge messen, Foto'),
            (2, '72,1', 1810, 135, 180, 57, ''),
            (3, '72,3', 1690, 122, 160, 60, ''),
            (4, '71,9', 2150, 110, 240, 78, 'Wochenende, Essen mit Freunden'),
            (5, '71,8', 1760, 131, 170, 58, ''),
            (6, '72,5', 1980, 118, 210, 72, 'Periode beginnt'),
            (7, '72,9', 1850, 125, 190, 66, 'Periode · Check-in abgeben'),
            (8, '72,7', 1700, 133, 158, 59, 'Periode · Knieschmerz im Training melden'),
            (9, '7,21', 1740, 129, 168, 60, 'Absichtlicher Tippfehler – Warnung ansehen, dann 72,1 eintragen'),
            (10, '71,8', 1680, 136, 152, 57, 'Periode endet'),
            (11, '71,6', 2300, 105, 260, 82, 'Wandertag'),
            (12, '–', '–', '–', '–', '–', 'Heute NICHT eintragen – erst morgen über 📅 nachtragen'),
            (13, '71,3', 1750, 134, 166, 59, 'Tag 12 nachtragen: 71,7 kg · 1720 kcal · 132 P · 162 KH · 58 F'),
            (14, '71,2', 1690, 130, 158, 58, 'Ende – Umfänge messen, Foto · Check-in'),
        ],
        # Tag, Schritte, aktive kcal, Schlaf h, Schlafqualität, Motivation, Energie, Ruhepuls, HRV
        'body': [
            (1, '8.400', 420, '7,5', 4, 4, 4, 62, 48),
            (2, '6.200', 380, '6,5', 3, 4, 3, 63, 45),
            (3, '9.100', 470, '7,0', 4, 4, 4, 61, 50),
            (4, '11.800', 610, '8,5', 5, 5, 4, 60, 52),
            (5, '7.600', 400, '7,0', 3, 4, 3, 62, 47),
            (6, '5.200', 290, '6,0', 2, 2, 2, 66, 40),
            (7, '6.900', 350, '7,5', 3, 2, 2, 65, 41),
            (8, '8.800', 450, '7,0', 3, 2, 3, 64, 43),
            (9, '9.400', 480, '7,5', 4, 3, 3, 62, 47),
            (10, '8.100', 430, '7,0', 4, 4, 4, 61, 49),
            (11, '21.500', 1150, '8,0', 5, 5, 4, 60, 53),
            (12, '–', '–', '–', '–', '–', '–', '–', '–'),
            (13, '7.900', 410, '7,0', 4, 4, 4, 61, 50),
            (14, '8.600', 440, '7,5', 4, 5, 4, 60, 52),
        ],
        'body_notes': 'Tag 12 nachtragen an Tag 13: 7.300 Schritte · 380 akt. kcal · 6,5 h · Qualität 3 · Motivation 4 · Energie 3 · Ruhepuls 62 · HRV 46. '
                      'Tag 6–8: Motivation 2 an drei Tagen hintereinander (testet die Warnung bei Max).',
        'training_days': [1, 3, 5, 8, 10, 13],
        'training': [
            # (Einheit, Übung, Sätze×Wdh, Gewicht Start, Hinweis)
            ('A', 'Kniebeuge (Back Squat)', '3 × 8–10', '50 kg', 'Tag 8: im Training „Schmerzen: linkes Knie“ angeben'),
            ('A', 'Kurzhantel-Bankdrücken', '3 × 8–12', '14 kg', ''),
            ('A', 'Latzug V-Griff (Neutralgriff)', '3 × 10–12', '40 kg', 'einmal über ⋮ „Übung tauschen“ testen'),
            ('A', 'Hip Thrust', '3 × 10–12', '70 kg', ''),
            ('A', 'Plank', '3 × 45 s', '–', 'Zeit statt Gewicht'),
            ('B', 'Rumänisches Kreuzheben', '3 × 8–10', '45 kg', ''),
            ('B', 'Kurzhantel-Schulterdrücken sitzend', '3 × 10–12', '10 kg', ''),
            ('B', 'Kabelrudern sitzend, breiter Griff (oberer Rücken)', '3 × 10–12', '35 kg', ''),
            ('B', 'Ausfallschritte rückwärts', '3 × 10 pro Seite', '8 kg', 'pro Seite (L/R) eintragen'),
            ('B', 'Seitheben Kurzhantel + Trizepsdrücken Seil', '3 × 12–15', '5 kg / 15 kg', 'Supersatz – direkt im Wechsel'),
        ],
        'training_rules': [
            'Ab dem 2. Training pro Übung 2,5 kg (Kurzhantel: 1 kg) mehr, sobald du in allen Sätzen die obere Wiederholungszahl schaffst.',
            'Vor Kniebeuge und Kreuzheben je 1 Aufwärmsatz mit halbem Gewicht (Satz auf „W“ stellen).',
            'Tag 10: Schalter „Anderes Gym“ an (du bist im Urlaub in einem fremden Studio) – Gewichte 10 % niedriger.',
            'Tag 13: zusätzlich ein „Freies Training“ starten und eine Übung selbst hinzufügen: Kettlebell Swing 3 × 15 mit 12 kg.',
        ],
        'cardio': [
            (2, 'Laufband', '25 min', '3,2 km', 'locker'),
            (4, 'Spazieren / Gehen', '45 min', '4,0 km', 'locker'),
            (7, 'Indoor-Cycling / Ergometer', '30 min', '–', 'Intervall'),
            (11, 'Wandern', '120 min', '9,0 km', 'lang'),
            (13, 'Laufen (draußen) mit dem KM Pacer', 'ca. 20 min', '3 km', 'Bildschirm anlassen'),
        ],
        'supplements': 'Kreatin 5 g und Vitamin D3 jeden Tag abhaken, außer Tag 4 und Tag 9 (vergessen). Whey nur an Trainingstagen.',
        'cycle': 'Tag 6 im Abend-Check „Periode hat an diesem Tag begonnen“. Tag 10 „Periode ist an diesem Tag zu Ende“. '
                 'Achte an Tag 6–9 auf den rosa Hinweis unter dem Gewicht.',
        'measure': [('Taille', '76,0', '74,5'), ('Hüfte', '101,0', '100,0'), ('Brust', '92,0', '91,5'), ('Oberarm', '28,0', '27,8'), ('Oberschenkel', '58,0', '57,2')],
        'checkins': [
            (7, 'gut (4)', 'viel (4)', 'mittel (3)', 'okay (3)', 'Heißhunger auf Süßes während der Periode, Knie zwickt bei Kniebeugen.'),
            (14, 'sehr gut (5)', 'normal (3)', 'wenig (2)', 'gut (4)', 'Wandertag war super, Gewicht geht runter.'),
        ],
        'request': 'Tag 9: Profil → „Termin anfragen“ → Online-Call: „Kurzer Call wegen meinem Knie, am liebsten Do oder Fr ab 18 Uhr.“',
        # for Max
        'setup': {
            'modules': 'Krafttraining, Cardio, Körpergewicht, Ernährung, Aktivität, Schlaf, Motivation & Befinden, Uhr-Werte, Supplemente, Zyklus, Erfolge',
            'unlocks': 'Fotos & Umfänge, Freies Training (beim Krafttraining unter „Freigaben“)',
            'consents': 'Zyklus und Fortschrittsfotos: Einwilligungs-Datum = Tag der Einrichtung',
            'calc': 'Rechner: weiblich, 24, 168 cm, 72,4 kg, „Mäßig aktiv“, −0,5 kg/Woche, Protein 2,0 g/kg, Fett 0,8 g/kg → ca. 1.760 kcal · 145 g P · 58 g F · 165 g KH → „Als Ziele übernehmen“',
            'targets': 'Schritte 8.000 · Schlaf 7,5 h · Cardio 90 min/Woche (Vorgabe: Di Laufband 25 min locker, Sa Wandern 60 min)',
            'plan': 'Neue Vorlage „Ganzkörper A/B (Test)“, 3 Einheiten/Woche, 6 Wochen, Deload in Woche 6 – Übungen wie auf Seite 3 der Test-PDF; Aufwärmsatz bei Kniebeuge/RDL = 1; Seitheben + Trizeps mit Supersatz „A“',
            'supps': 'Kreatin 5 g (täglich), Vitamin D3 (täglich), Whey (Trainingstage)',
            'checkin': 'Check-in-Tag: Sonntag',
        },
    },
]


# ---------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------
CSS = """
@page { size: A4; margin: 14mm 0 15mm; }
@page :first { margin-top: 0; }
:root { --navy:#111827; --blue:#2563eb; --blue-soft:#eef3fe; --line:#dbe3ef; --field:#f3f6fb; --ink:#1f2937; --muted:#6b7280; --pink:#db2777; --pink-soft:#fdf0f6; --amber:#b45309; --amber-soft:#fdf4e3; --ok:#15803d; --ok-soft:#e8f6ed; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: Lato, "Segoe UI", Arial, sans-serif; color: var(--ink); font-size: 9pt; line-height: 1.36; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.wrap { padding: 0 14mm; }
.band { background: var(--navy); color: #fff; padding: 7mm 14mm 5mm; border-bottom: 2.2mm solid var(--blue); }
.band .top { display: flex; justify-content: space-between; font-size: 8.4pt; margin-bottom: 5mm; }
.band .top b { font-weight: 900; letter-spacing: .04em; } .band .top span { color: #60a5fa; font-weight: 700; margin-left: 8px; letter-spacing: .06em; }
.band h1 { font-size: 22pt; font-weight: 900; margin: 0 0 1.5mm; }
.band p { margin: 0; color: #cbd5e1; font-size: 10pt; }
h2 { display: flex; align-items: center; gap: 3mm; font-size: 12.5pt; font-weight: 900; margin: 4.5mm 0 2mm; break-after: avoid; }
h2 .n { width: 6.5mm; height: 6.5mm; border-radius: 1.4mm; background: var(--blue); color: #fff; font-size: 9.5pt; display: inline-flex; align-items: center; justify-content: center; flex: none; }
h3 { font-size: 10pt; margin: 4mm 0 1.5mm; font-weight: 900; break-after: avoid; }
p { margin: 1.2mm 0; }
.lead { color: var(--muted); margin: -1mm 0 2.5mm; }
.box { border-radius: 2mm; padding: 3mm 4mm; margin: 3.5mm 0 2.5mm; }
.box.blue { background: var(--blue-soft); border-left: 3px solid var(--blue); }
.box.amber { background: var(--amber-soft); border-left: 3px solid #f59e0b; }
.box.pink { background: var(--pink-soft); border-left: 3px solid var(--pink); }
.access { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; margin: 3mm 0; }
.access div { background: var(--field); border: 1px solid var(--line); border-radius: 2mm; padding: 3mm; }
.access small { display: block; color: var(--muted); font-size: 7.8pt; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
.access strong { font-size: 12pt; font-family: Consolas, monospace; }
.access .pw { border-bottom: 1px solid #9aa6b8; height: 6mm; margin-top: 1mm; }
.kv { display: grid; grid-template-columns: 34mm 1fr; gap: 1.4mm 4mm; }
.kv div:nth-child(odd) { color: var(--muted); font-weight: 700; font-size: 8.6pt; }
.persona { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.card { border: 1px solid var(--line); border-radius: 2mm; padding: 3mm 3.5mm; break-inside: avoid; }
table { width: 100%; border-collapse: collapse; font-size: 8.6pt; break-inside: auto; }
th { text-align: left; font-size: 7.2pt; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 700; padding: 1.2mm 1.6mm; border-bottom: 1.5px solid var(--navy); }
td { padding: 1.15mm 1.6mm; border-bottom: 1px solid var(--line); vertical-align: top; }
tr { break-inside: avoid; }
td.c, th.c { text-align: center; }
tr.hl td { background: var(--pink-soft); }
tr.warn td { background: var(--amber-soft); }
tr.skip td { background: #f3f4f6; color: var(--muted); }
.note { color: var(--muted); font-size: 8pt; }
ul.check { list-style: none; margin: 0; padding: 0; }
ul.check li { position: relative; padding-left: 5mm; margin: .8mm 0; break-inside: avoid; }
ul.check li::before { content: ""; position: absolute; left: 0; top: 1.1mm; width: 2.6mm; height: 2.6mm; border: 1.2px solid var(--blue); border-radius: .6mm; background: #fff; }
.cols2 { columns: 2; column-gap: 7mm; }
.page { break-before: page; }
.runhead { display: flex; justify-content: space-between; font-size: 7.8pt; border-bottom: 1px solid var(--line); padding-bottom: 2mm; margin: 0 0 4mm; }
.runhead b { font-weight: 900; } .runhead span { color: var(--blue); margin-left: 6px; }
.mod { break-inside: avoid; margin-bottom: 2.5mm; }
.mod b { display: block; }
.fill { border-bottom: 1px solid #9aa6b8; height: 5.5mm; }
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
    rows_food = ''.join(
        f'<tr class="{"skip" if r[1] == "–" else "warn" if "Tippfehler" in r[6] else "hl" if "Periode" in r[6] else ""}">'
        f'<td class="c"><b>{r[0]}</b></td><td class="c">{r[1]}</td><td class="c">{r[2]}</td><td class="c">{r[3]}</td><td class="c">{r[4]}</td><td class="c">{r[5]}</td><td>{E(r[6])}</td></tr>'
        for r in p['food'])
    rows_body = ''.join(
        f'<tr class="{"skip" if r[1] == "–" else ""}">' + ''.join(f'<td class="c">{"<b>%s</b>" % v if i == 0 else v}</td>' for i, v in enumerate(r)) + '</tr>'
        for r in p['body'])
    rows_train = ''.join(f'<tr><td class="c"><b>{E(t[0])}</b></td><td>{E(t[1])}</td><td>{E(t[2])}</td><td>{E(t[3])}</td><td class="note">{E(t[4])}</td></tr>' for t in p['training'])
    rows_cardio = ''.join(f'<tr><td class="c"><b>{c[0]}</b></td><td>{E(c[1])}</td><td>{E(c[2])}</td><td>{E(c[3])}</td><td>{E(c[4])}</td></tr>' for c in p['cardio'])
    rows_meas = ''.join(f'<tr><td>{E(m[0])}</td><td class="c">{m[1]} cm</td><td class="c">{m[2]} cm</td></tr>' for m in p['measure'])
    rows_ci = ''.join(f'<tr><td class="c"><b>{c[0]}</b></td><td>{E(c[1])}</td><td>{E(c[2])}</td><td>{E(c[3])}</td><td>{E(c[4])}</td><td>{E(c[5])}</td></tr>' for c in p['checkins'])
    facts = ''.join(f'<div>{E(k)}</div><div>{E(v)}</div>' for k, v in p['facts'])
    tdays = ', '.join(str(d) for d in p['training_days'])

    return HEAD.replace('{title}', f'Testzugang {p["n"]} – {name}') + band(f'Testzugang {p["n"]}: {name} (fiktiv)', 'Du testest 14 Tage lang die mxCoaching-App – mit einer erfundenen Person, nicht mit deinen eigenen Daten.') + f'''
<main class="wrap">
  <div class="box blue"><b>Danke, dass du testest!</b> Du schlüpfst 14 Tage lang in die Rolle von <b>{E(name)}</b>. Trag jeden Tag die Werte aus dieser PDF ein,
  trainiere „ihr“ Training in der App und probiere alle Funktionen aus. Das dauert ca. 3–5 Minuten am Tag. Am Ende schreibst du Max, was gut war und was nicht.</div>

  <div class="access">
    <div><small>App</small><strong>app.mxreinert.de</strong></div>
    <div><small>Benutzername</small><strong>{E(p["username"])}</strong></div>
    <div><small>Startpasswort</small><div class="pw"></div><span class="note">bekommst du von Max</span></div>
  </div>

  <div class="box amber"><b>Wichtig – bitte lesen</b>
    <ul class="check" style="margin-top:1.5mm">
      <li><b>Keine eigenen Daten:</b> Trag nur die Werte aus dieser PDF ein – nicht dein Gewicht, deinen Schlaf oder deine Gesundheitsdaten.</li>
      <li><b>Keine Fotos von dir:</b> Beim Fortschrittsfoto fotografierst du z. B. eine Wasserflasche oder eine Wand.</li>
      <li><b>Erster Login:</b> Du musst ein eigenes Passwort setzen. Danach die App zum Homescreen hinzufügen (iPhone: Safari → Teilen → „Zum Home-Bildschirm“) und Push erlauben.</li>
      <li><b>„Tag 1“</b> ist der Tag, an dem du anfängst. Die Wochentage sind egal.</li>
    </ul>
  </div>

  <h2><span class="n">1</span>Steckbrief: {E(name)}</h2>
  <div class="persona">
    <div class="kv">
      <div>Name</div><div>{E(p["first"])} {E(p["last"])}</div>
      <div>Geburtsdatum</div><div>{E(p["birth"])} ({p["age"]} Jahre)</div>
      <div>Geschlecht</div><div>{E(p["sex"])}</div>
      <div>Größe</div><div>{p["height"]} cm</div>
      <div>Startgewicht</div><div>{p["start_weight"]} kg</div>
      <div>Ziel</div><div><b>{E(p["goal"])}</b>, {E(p["tempo"])}</div>
    </div>
    <div class="kv">{facts}</div>
  </div>
  <p style="margin-top:3mm"><b>Ihr Ziel in einem Satz:</b> {E(p["goal_text"])}</p>

  <h2><span class="n">2</span>So läuft ein Tag</h2>
  <ul class="check">
    <li><b>Morgens:</b> Gewicht aus der Tabelle eintragen (Heute → Karte „Wiegen“ oder Eintragen).</li>
    <li><b>Abends:</b> Abend-Check (unten „Eintragen“) mit allen Werten des Tages.</li>
    <li><b>An Trainingstagen</b> (Tag {tdays}): Training starten und Satz für Satz abhaken.</li>
    <li><b>Cardio-Tage:</b> Einheit unter Training → Cardio eintragen.</li>
    <li><b>Tag 7 und 14:</b> wöchentlicher Check-in. <b>Tag 1 und 14:</b> Umfänge + Foto.</li>
  </ul>
</main>

<main class="wrap page">
  {runhead(f"Testzugang {p['n']} · {name} · Tageswerte")}
  <h2><span class="n">3</span>Morgens wiegen &amp; Ernährung</h2>
  <p class="lead">Werte wie aus Yazio übernommen. Rosa = Periode, gelb = absichtlicher Tippfehler, grau = an diesem Tag nichts eintragen.</p>
  <table><thead><tr><th class="c">Tag</th><th class="c">Gewicht kg</th><th class="c">kcal</th><th class="c">Protein g</th><th class="c">KH g</th><th class="c">Fett g</th><th>Besonderes</th></tr></thead><tbody>{rows_food}</tbody></table>

  <h2><span class="n">4</span>Aktivität, Schlaf &amp; Befinden (Uhr)</h2>
  <table><thead><tr><th class="c">Tag</th><th class="c">Schritte</th><th class="c">Aktive kcal</th><th class="c">Schlaf h</th><th class="c">Schlaf­qualität 1–5</th><th class="c">Motivation 1–5</th><th class="c">Energie 1–5</th><th class="c">Ruhepuls</th><th class="c">HRV ms</th></tr></thead><tbody>{rows_body}</tbody></table>
  <p class="note" style="margin-top:2mm">{E(p["body_notes"])}</p>

</main>

<main class="wrap page">
  {runhead(f"Testzugang {p['n']} · {name} · Training")}
  <h2><span class="n">5</span>Krafttraining (Plan kommt von Max)</h2>
  <p class="lead">Trainingstage: Tag {tdays} – abwechselnd Einheit A und B. Start-Gewichte:</p>
  <table><thead><tr><th class="c">Einheit</th><th>Übung</th><th>Sätze × Wdh.</th><th>Startgewicht</th><th>Hinweis</th></tr></thead><tbody>{rows_train}</tbody></table>
  <ul class="check" style="margin-top:2mm">{''.join(f'<li>{E(r)}</li>' for r in p['training_rules'])}</ul>

  <h2><span class="n">6</span>Cardio</h2>
  <table><thead><tr><th class="c">Tag</th><th>Art</th><th>Dauer</th><th>Distanz</th><th>Intensität</th></tr></thead><tbody>{rows_cardio}</tbody></table>

</main>

<main class="wrap page">
  {runhead(f"Testzugang {p['n']} · {name} · Zyklus, Supplemente, Umfänge, Check-in")}
  <h2><span class="n">7</span>Zyklus</h2>
  <div class="box pink">{E(p["cycle"])}</div>
  <h2><span class="n">8</span>Supplemente</h2>
  <p>{E(p["supplements"])}</p>
  <h2><span class="n">9</span>Umfänge (Tag 1 und Tag 14)</h2>
  <table style="width:60%"><thead><tr><th>Stelle</th><th class="c">Tag 1</th><th class="c">Tag 14</th></tr></thead><tbody>{rows_meas}</tbody></table>

  <h2><span class="n">10</span>Check-in-Antworten</h2>
  <table><thead><tr><th class="c">Tag</th><th>Woche war</th><th>Hunger</th><th>Stress</th><th>Erholung</th><th>Was war schwierig?</th></tr></thead><tbody>{rows_ci}</tbody></table>
  <h2><span class="n">11</span>Termin anfragen</h2>
  <p>{E(p["request"])}</p>
</main>

<main class="wrap page">
  {runhead(f"Testzugang {p['n']} · {name} · Testaufgaben")}
  <h2><span class="n">12</span>Testaufgaben – zum Abhaken</h2>
  <p class="lead">Probier alles einmal aus. Wenn etwas nicht klappt oder komisch aussieht: Screenshot machen.</p>
  <div class="cols2">
    <div class="mod"><b>Start &amp; Konto</b><ul class="check"><li>Login, eigenes Passwort setzen</li><li>Einführung durchklicken</li><li>App zum Homescreen, Push erlauben</li><li>Profil: Farbmodus wechseln, Erinnerungszeiten ändern</li></ul></div>
    <div class="mod"><b>Heute</b><ul class="check"><li>Ringe (Kalorien, Protein, Schritte, Woche) verstehen</li><li>Feedback von Max lesen und „Gelesen“ tippen</li></ul></div>
    <div class="mod"><b>Abend-Check</b><ul class="check"><li>Alle Felder ausfüllen</li><li>Tag 9: Tippfehler-Warnung sehen, korrigieren</li><li>Tag 12 auslassen, an Tag 13 über 📅 nachtragen</li><li>Einmal „nicht getrackt“ bei einem Feld testen</li></ul></div>
    <div class="mod"><b>Krafttraining</b><ul class="check"><li>Training starten, Sätze abhaken (grün)</li><li>„Vorher“ antippen übernimmt alte Werte</li><li>Pausentimer: −15 / +15 / Überspringen</li><li>Satz auf „W“ (Aufwärmen) stellen</li><li>Übung tauschen über ⋮</li><li>Supersatz ohne Pause dazwischen</li><li>Tag 8: Schmerzen melden</li><li>Tag 10: „Anderes Gym“</li><li>Tag 13: Freies Training</li><li>Neuen Rekord (🏅) erreichen</li></ul></div>
    <div class="mod"><b>Cardio</b><ul class="check"><li>Einheiten aus „Häufigste“ und „Weitere“ wählen</li><li>KM Pacer einmal draußen (oder im Flur) starten</li></ul></div>
    <div class="mod"><b>Supplemente</b><ul class="check"><li>Täglich abhaken, an zwei Tagen vergessen</li></ul></div>
    <div class="mod"><b>Zyklus</b><ul class="check"><li>Beginn Tag 6, Ende Tag 10</li><li>Rosa Hinweis beim Gewicht sehen</li><li>Zyklus-Karte auf „Heute“</li></ul></div>
    <div class="mod"><b>Fotos &amp; Umfänge</b><ul class="check"><li>Umfänge Tag 1 und 14</li><li>Foto (Wasserflasche!) hochladen und Vergleich ansehen</li></ul></div>
    <div class="mod"><b>Check-in</b><ul class="check"><li>Tag 7 und 14 abgeben</li><li>Antwort von Max lesen</li></ul></div>
    <div class="mod"><b>Auswertung</b><ul class="check"><li>Gewicht mit 7-Tage-Schnitt ansehen</li><li>Zeitraum 7 Tage / 4 Wochen umschalten</li><li>Kraftverlauf (1RM) einer Übung ansehen</li></ul></div>
    <div class="mod"><b>Erfolge</b><ul class="check"><li>Löwe nach dem 1. Training</li><li>„3 Tage am Stück“, „7 Tage am Stück“</li><li>Erfolge-Seite öffnen, Löwe antippen</li></ul></div>
    <div class="mod"><b>Termin anfragen</b><ul class="check"><li>{E(p["request"])}</li><li>Antwort von Max sehen</li></ul></div>
    <div class="mod"><b>Hilfe</b><ul class="check"><li>FAQ öffnen, „Max auf WhatsApp“ antippen (nicht senden)</li><li>Abmelden und wieder anmelden</li></ul></div>
  </div>

  <h2><span class="n">13</span>Dein Feedback an Max</h2>
  <p>Am Ende (oder sofort, wenn etwas kaputt ist) per WhatsApp an Max: <b>Screenshot + kurz, wo du warst und was du erwartet hast.</b></p>
  <div class="kv" style="grid-template-columns:62mm 1fr; gap:3mm 4mm; margin-top:3mm">
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
  <div class="kv" style="grid-template-columns:40mm 1fr">
    <div>Kunde anlegen</div><div>Vorname {E(p["first"])}, Nachname {E(p["last"])}, Geburtsdatum {E(p["birth"])}, Ziel {E(p["goal"])}, Einwilligung = heute</div>
    <div>Login</div><div>Benutzername <b>{E(p["username"])}</b>, Startpasswort selbst wählen (mind. 10 Zeichen) und der Testperson separat schicken – nicht in die PDF schreiben</div>
    <div>Module an</div><div>{E(s["modules"])}</div>
    <div>Freischalten</div><div>{E(s["unlocks"])}</div>
    <div>Einwilligungen</div><div>{E(s["consents"])}</div>
    <div>Ernährung</div><div>{E(s["calc"])}</div>
    <div>Weitere Ziele</div><div>{E(s["targets"])}</div>
    <div>Trainingsplan</div><div>{E(s["plan"])}</div>
    <div>Supplemente</div><div>{E(s["supps"])}</div>
    <div>Konzept</div><div>{E(s["checkin"])}</div>
  </div>'''
    return HEAD.replace('{title}', 'Einrichtung Testzugänge') + band('Einrichtung der Testzugänge', 'Nur für Max – nicht an Testpersonen weitergeben') + f'''
<main class="wrap">
  <div class="box blue"><b>Ablauf pro Testperson:</b> Kunde anlegen → Konto mit Benutzername + Startpasswort → Module, Freischaltungen, Einwilligungen → Ernährungs-Rechner → Plan zuweisen → Supplemente → PDF schicken, Passwort separat per WhatsApp.
  Während des Tests: Check-ins beantworten, eine Terminanfrage ablehnen/antworten, Ampel beobachten. Nach dem Test: Testkonten löschen (LAUNCH.md).</div>
  <div class="box amber"><b>Nicht testen:</b> Hevy und Personal Training. <b>Du selbst testest:</b> Abrechnung (Testpaket 0 €), Eltern-Bericht (bei minderjähriger Testperson), Kunden-Export.</div>
  {blocks}
</main></body></html>'''


def to_pdf(html_text, name):
    src = os.path.join(HERE, '_' + name + '.html')
    out = os.path.join(HERE, name + '.pdf')
    with open(src, 'w', encoding='utf-8') as f:
        f.write(html_text)
    url = 'file:///' + src.replace('\\', '/').replace(' ', '%20')
    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000',
                    f'--print-to-pdf={out}', url], check=True)
    os.remove(src)
    return out


if __name__ == '__main__':
    for p in PERSONAS:
        print(to_pdf(tester_html(p), f'Testzugang-{p["n"]}-{p["first"]}'))
    print(to_pdf(setup_html(PERSONAS), 'Einrichtung-Testzugaenge'))
