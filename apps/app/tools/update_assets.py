"""Before each deploy: refresh the service worker cache version + precache list and the
<link rel="modulepreload"> hints in home.html. No bundler needed.

Usage (repo root):  python apps/app/tools/update_assets.py
"""
import hashlib
import os
import re

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src')
SKIP_DIRS = {os.path.join('modules', 'cardio', 'pacer')}
EXT = ('.js', '.css', '.html', '.svg', '.webmanifest')


def files():
    out = []
    for root, dirs, names in os.walk(SRC):
        rel_root = os.path.relpath(root, SRC)
        if any(rel_root == d or rel_root.startswith(d + os.sep) for d in SKIP_DIRS):
            continue
        for n in names:
            if n.endswith(EXT) and n != 'sw.js':
                out.append('/' + os.path.relpath(os.path.join(root, n), SRC).replace(os.sep, '/'))
    return sorted(out)


def main():
    all_files = files()
    h = hashlib.sha256()
    for f in all_files:
        with open(SRC + f, 'rb') as fh:
            h.update(f.encode() + fh.read())
    version = h.hexdigest()[:10]

    # service worker: cache name + precache list
    sw_path = os.path.join(SRC, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    sw = re.sub(r"const CACHE = '[^']*';", f"const CACHE = 'mx-app-{version}';", sw)
    listing = ',\n  '.join(f"'{f}'" for f in all_files if f not in ('/404.html',))
    sw = re.sub(r"const PRECACHE = \[[\s\S]*?\];", f"const PRECACHE = [\n  {listing}\n];", sw)
    open(sw_path, 'w', encoding='utf-8', newline='\n').write(sw)

    # home.html: modulepreload for every app module (flattens the import waterfall)
    js = [f for f in all_files if f.endswith('.js') and not f.startswith('/vendor/')
          and f not in ('/core/theme.js', '/core/pages/login.js', '/core/pages/mfa.js', '/core/pages/password.js')]
    tags = '\n'.join(f'  <link rel="modulepreload" href="{f}">' for f in js)
    home_path = os.path.join(SRC, 'home.html')
    home = open(home_path, encoding='utf-8').read()
    home = re.sub(r'  <!-- preload:start -->[\s\S]*?<!-- preload:end -->',
                  f'  <!-- preload:start -->\n{tags}\n  <!-- preload:end -->', home)
    open(home_path, 'w', encoding='utf-8', newline='\n').write(home)
    print(f'version mx-app-{version}, {len(all_files)} files precached, {len(js)} modules preloaded')


if __name__ == '__main__':
    main()
