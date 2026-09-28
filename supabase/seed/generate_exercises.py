"""Generate supabase/seed/exercises.sql from docs/Uebungsdatenbank.xlsx.

Usage (from repo root):  python supabase/seed/generate_exercises.py
No extra packages needed (reads the xlsx XML directly).
"""
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX = os.path.join(ROOT, 'docs', 'Uebungsdatenbank.xlsx')
OUT = os.path.join(ROOT, 'supabase', 'seed', 'exercises.sql')
M = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

TRACKING = {
    'Gewicht × Wdh': 'weight_reps',
    'Körpergewicht × Wdh': 'bodyweight_reps',
    'Körpergewicht + Zusatz × Wdh': 'bodyweight_plus',
    'Assistenz × Wdh': 'assisted',
    'Zeit': 'time',
    'Distanz': 'distance',
}


def col_index(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_rows(zf):
    shared = []
    if 'xl/sharedStrings.xml' in zf.namelist():
        root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
        shared = [''.join(t.text or '' for t in si.iter(M + 't')) for si in root]
    sheet = ET.fromstring(zf.read('xl/worksheets/sheet1.xml'))
    rows = []
    for r in sheet.iter(M + 'row'):
        out = [''] * 15
        for c in r:
            t, v = c.get('t'), c.find(M + 'v')
            if t == 'inlineStr':
                val = ''.join(x.text or '' for x in c.iter(M + 't'))
            elif t == 's':
                val = shared[int(v.text)]
            else:
                val = v.text if v is not None else ''
            i = col_index(c.get('r'))
            if i < 15:
                out[i] = (val or '').strip()
        rows.append(out)
    return rows


def q(s):
    return 'null' if s == '' else "'" + s.replace("'", "''") + "'"


def main():
    with zipfile.ZipFile(XLSX) as zf:
        rows = read_rows(zf)
    data = [r for r in rows[1:] if r[0]]
    ids = {r[0] for r in data}
    problems = []
    values = []
    for i, r in enumerate(data):
        (id_, name, base, pattern, prim, sec, equip, uni, track, lvl, a1, a2, vid, hint, act) = r
        if track not in TRACKING:
            problems.append(f'{id_}: unbekannter Tracking-Typ "{track}"')
        for a in (a1, a2):
            if a and a not in ids:
                problems.append(f'{id_}: Alternative "{a}" existiert nicht')
        if vid and not vid.startswith('https://'):
            problems.append(f'{id_}: Videolink muss mit https:// beginnen')
        secondary = [s.strip() for s in sec.split(',') if s.strip()]
        sec_sql = ('array[' + ','.join(q(s) for s in secondary) + ']::text[]') if secondary else "'{}'::text[]"
        values.append(
            f"  ({q(id_)}, {q(name)}, {q(base)}, {q(pattern)}, {q(prim)}, {sec_sql}, {q(equip)}, "
            f"{'true' if uni == 'ja' else 'false'}, {q(TRACKING.get(track, 'weight_reps'))}, {q(lvl)}, "
            f"{q(a1) if a1 in ids else 'null'}, {q(a2) if a2 in ids else 'null'}, "
            f"{q(vid) if vid.startswith('https://') else 'null'}, {q(hint)}, "
            f"{'false' if act == 'nein' else 'true'}, {i})")

    sql = (
        '-- Seed: exercise database generated from docs/Uebungsdatenbank.xlsx\n'
        '-- Do not edit by hand: change the xlsx and run supabase/seed/generate_exercises.py\n'
        '-- Re-run safe: existing IDs are updated.\n'
        'begin;\n'
        'set constraints all deferred;\n'
        'insert into public.exercises\n'
        '  (id, name, base, pattern, primary_muscle, secondary, equipment, unilateral, tracking_type,'
        ' level, alt1, alt2, video_url, hint, active, sort)\nvalues\n'
        + ',\n'.join(values) +
        '\non conflict (id) do update set\n'
        '  name = excluded.name, base = excluded.base, pattern = excluded.pattern,\n'
        '  primary_muscle = excluded.primary_muscle, secondary = excluded.secondary,\n'
        '  equipment = excluded.equipment, unilateral = excluded.unilateral,\n'
        '  tracking_type = excluded.tracking_type, level = excluded.level,\n'
        '  alt1 = excluded.alt1, alt2 = excluded.alt2, video_url = excluded.video_url,\n'
        '  hint = excluded.hint, active = excluded.active, sort = excluded.sort;\n'
        'commit;\n')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(sql)
    print(f'{len(data)} Übungen geschrieben nach {OUT}')
    for p in problems:
        print('WARNUNG:', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
