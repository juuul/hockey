#!/usr/bin/env python3
"""Regressiecheck vóór elke publicatie naar test (zie CLAUDE.md).

1. Typecheck en syntaxcontrole van de hooks.
2. Alle offline unit-tests (TypeScript, Python, Node) zonder netwerk.
3. Vindbaarheid van álle catalogusclubs/-teams uit test én productie (read-only, alleen openbare velden).
4. Het fictieve regressieteam op de testserver: eigen afspraken, verwijderde bronwedstrijd, zaalovername.
5. De gebouwde testapp in headless Chrome tegen de testserver; daarna stap 4 opnieuw.

Privé (buiten git): planning_documenten/test/regressie-account.json en regressie-verwachting.json.
Gebruik: python3 server/tests/regressie.py [--zonder-browser] [--vastleggen]
"""
import argparse
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SERVER = REPO / 'server'
PRIVE = SERVER / 'planning_documenten' / 'test'
ESBUILD = REPO / 'node_modules' / '.bin' / 'esbuild'
NODE_TESTS = ['catalogus-browser.cjs', 'catalogus-locaties.cjs', 'deellink.cjs', 'mailteksten.cjs', 'zaalspelers.cjs', 'kalenders.mjs', 'reiscache.mjs']
# Velden die de gebruiker zelf beheert; bron- en automatische velden mogen wel veranderen.
EIGEN_VELDEN = ['datum', 'soort', 'thuis', 'spelen', 'verzamelen', 'verzamelDatum', 'verzamelModus', 'tegenstander', 'locatie', 'locatieAdres', 'fruit', 'begeleider1', 'begeleider2', 'rijders', 'notitie']
PREVIEW_POORT = 8799  # staat in de --origins van de testserver

resultaten = []


def stap(naam, functie):
    begin = time.time()
    try:
        uitleg = functie() or ''
        resultaten.append((True, naam, uitleg))
        print(f'✓ {naam} ({time.time() - begin:.0f}s) {uitleg}', flush=True)
    except Exception as fout:  # noqa: BLE001 - elke fout is een gefaalde stap
        resultaten.append((False, naam, str(fout)))
        print(f'✗ {naam}: {fout}', flush=True)


def draai(cmd, cwd=REPO, env=None, timeout=300):
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    if r.returncode:
        raise RuntimeError(f'{" ".join(map(str, cmd[:6]))} …\n{(r.stdout + r.stderr).strip()[-2000:]}')
    return r.stdout


def statisch():
    draai(['npx', 'tsc', '--noEmit', '-p', '.'])
    hooks = sorted((SERVER / 'pb_hooks').glob('*.js'))
    for hook in hooks:
        draai(['node', '--check', str(hook)])
    return f'typecheck + {len(hooks)} hooks'


def unit(tmp):
    aantal = 0
    for ts in sorted((SERVER / 'tests').glob('*.ts')):
        if ts.stem == 'catalogus-vindbaar':
            continue
        uit = Path(tmp) / f'{ts.stem}.mjs'
        draai([str(ESBUILD), str(ts), '--bundle', '--platform=node', '--format=esm', f'--outfile={uit}', '--log-level=error'])
        draai(['node', str(uit)]); aantal += 1
    for py in sorted((SERVER / 'tests').glob('*.py')):
        if py.name not in (Path(__file__).name, 'catalogus-licht-modules.py'):  # die laatste haalt CDN-modules op
            draai([sys.executable, '-I', str(py)]); aantal += 1
    for js in NODE_TESTS:
        draai(['node', str(SERVER / 'tests' / js)]); aantal += 1
    return f'{aantal} tests'


def catalogus(tmp, omgeving, map_):
    db = sqlite3.connect((SERVER / map_ / 'data.db').resolve().as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    clubs = [dict(r) for r in db.execute('SELECT bronId, naam, plaats FROM catalogus_clubs')]
    teams = [dict(r) for r in db.execute('SELECT id, naam, clubBronId, seizoen, geslacht, leeftijd, spelvorm FROM catalogus_teams WHERE actief = 1')]
    db.close()
    invoer = Path(tmp) / f'catalogus-{omgeving}.json'
    invoer.write_text(json.dumps({'omgeving': omgeving, 'clubs': clubs, 'teams': teams}))
    uit = Path(tmp) / 'catalogus-vindbaar.mjs'
    if not uit.exists():
        draai([str(ESBUILD), str(SERVER / 'tests' / 'catalogus-vindbaar.ts'), '--bundle', '--platform=node', '--format=esm', f'--outfile={uit}', '--log-level=error'])
    return draai(['node', str(uit), str(invoer)]).strip().split(': ', 1)[-1]


class Testserver:
    def __init__(self):
        self.a = json.loads((PRIVE / 'regressie-account.json').read_text())
        self.sessie = self.req('POST', '/api/collections/users/auth-with-password', {'identity': self.a['email'], 'password': self.a['wachtwoord']})

    def req(self, method, pad, body=None):
        headers = {'Content-Type': 'application/json'}
        if getattr(self, 'sessie', None):
            headers['Authorization'] = self.sessie['token']
        r = urllib.request.Request(self.a['server'] + pad, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
        with urllib.request.urlopen(r, timeout=20) as f:
            return json.load(f)

    def lijst(self, collectie, filter_):
        return self.req('GET', f'/api/collections/{collectie}/records?perPage=500&filter=' + urllib.parse.quote(filter_))['items']


def vastleggen():
    """Leg de huidige eigen waarden van de gemarkeerde regressierecords vast als verwachting."""
    pad = PRIVE / 'regressie-verwachting.json'
    v = json.loads(pad.read_text())
    s = Testserver()
    for r in v['records']:
        rec = s.req('GET', f"/api/collections/programma/records/{r['id']}")
        r['velden'] = {k: rec[k] for k in r['velden']}
    pad.write_text(json.dumps(v, ensure_ascii=False, indent=1))
    print('Verwachting vastgelegd voor', len(v['records']), 'records')


def regressieteam():
    v = json.loads((PRIVE / 'regressie-verwachting.json').read_text())
    s = Testserver()
    fouten = []
    for r in v['records']:
        try:
            rec = s.req('GET', f"/api/collections/programma/records/{r['id']}")
        except urllib.error.HTTPError as e:
            fouten.append(f"{r['omschrijving']}: record weg ({e.code})"); continue
        for k, w in r['velden'].items():
            if rec.get(k) != w:
                fouten.append(f"{r['omschrijving']}: {k} is {rec.get(k)!r}, verwacht {w!r}")
    veld = s.lijst('programma', f"team=\"{v['veldteam']}\"")
    if any(p['bronId'] == v['verwijderdeBronId'] for p in veld):
        fouten.append('Bewust verwijderde bronwedstrijd is teruggekomen')
    met_bron = sum(1 for p in veld if p['bronId'])
    if not met_bron:
        fouten.append('Veldteam heeft geen enkele bronwedstrijd meer')
    namen = {t: sorted(x['naam'] for x in s.lijst('spelers', f'team="{t}"')) for t in (v['veldteam'], v['zaalteam'])}
    if len(namen[v['zaalteam']]) != v['aantalSpelers'] or namen[v['zaalteam']] != namen[v['veldteam']]:
        fouten.append(f'Spelers veld/zaal wijken af: {namen}')
    zaal_bron = sum(1 for p in s.lijst('programma', f"team=\"{v['zaalteam']}\"") if p['bronId'])
    if fouten:
        raise RuntimeError('\n  ' + '\n  '.join(fouten))
    return f"{len(v['records'])} eigen afspraken ongewijzigd, verwijdering blijft, {met_bron} veld- en {zaal_bron} zaalbronwedstrijden, {v['aantalSpelers']} spelers in veld én zaal"


def browser(tmp):
    v = json.loads((PRIVE / 'regressie-verwachting.json').read_text())
    s = Testserver()
    dist = Path(tmp) / 'dist'
    env = {**os.environ, 'VITE_SERVER': f"http://localhost:{urllib.parse.urlparse(s.a['server']).port}"}
    draai(['npx', 'vite', 'build', '--mode', 'test', '--outDir', str(dist), '--emptyOutDir'], env=env)
    preview = subprocess.Popen([str(REPO / 'node_modules' / '.bin' / 'vite'), 'preview', '--outDir', str(dist), '--port', str(PREVIEW_POORT), '--strictPort', '--host', 'localhost'], cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(f'http://localhost:{PREVIEW_POORT}/', timeout=1); break
            except OSError:
                time.sleep(0.2)
        uit = draai(['docker', 'run', '--rm', '--network', 'host', '--user', f'{os.getuid()}:{os.getgid()}',
                     '-v', f"{SERVER / 'tests' / 'regressie-ui.cjs'}:/test.cjs:ro",
                     '-e', f'APP_URL=http://localhost:{PREVIEW_POORT}/', '-e', 'REGRESSIE_SESSIE', '-e', 'REGRESSIE_TEKSTEN',
                     '--entrypoint', 'node', 'zenika/alpine-chrome:with-puppeteer', '/test.cjs'], timeout=240,
                    # Via de omgeving, zodat het testtoken nooit in een foutmelding met de opdrachtregel staat.
                    env={**os.environ, 'REGRESSIE_SESSIE': json.dumps({'token': s.sessie['token'], 'record': s.sessie['record']}),
                         'REGRESSIE_TEKSTEN': json.dumps(v['teksten'], ensure_ascii=False)})
    finally:
        preview.terminate(); preview.wait(10)
    return uit.strip().split(': ', 1)[-1]


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--zonder-browser', action='store_true')
    p.add_argument('--vastleggen', action='store_true', help='Huidige eigen waarden als nieuwe verwachting bewaren')
    args = p.parse_args()
    if args.vastleggen:
        return vastleggen()
    tmp = tempfile.mkdtemp(prefix='hockey-regressie-')
    try:
        stap('Typecheck en hooks', statisch)
        stap('Unit-tests', lambda: unit(tmp))
        stap('Vindbaarheid catalogus test', lambda: catalogus(tmp, 'test', 'pb_test_data'))
        stap('Vindbaarheid catalogus productie (alleen lezen)', lambda: catalogus(tmp, 'productie', 'pb_data'))
        stap('Regressieteam op testserver', regressieteam)
        if not args.zonder_browser:
            stap('Gebouwde testapp in Chrome', lambda: browser(tmp))
            stap('Regressieteam na appbezoek', regressieteam)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    mis = [r for r in resultaten if not r[0]]
    print(f"\n{'REGRESSIE_OK' if not mis else 'REGRESSIE_MISLUKT'}: {len(resultaten) - len(mis)}/{len(resultaten)} stappen geslaagd")
    sys.exit(1 if mis else 0)


if __name__ == '__main__':
    main()
