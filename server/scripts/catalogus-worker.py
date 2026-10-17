#!/usr/bin/env python3
"""Verwerk openbare importverzoeken voor uitsluitend de gekozen omgeving.
Geen rechtstreeks schrijven naar sqlite, geen productiecredentials.
"""
import argparse
import fcntl
import importlib.util
import json
from pathlib import Path
import subprocess
import sqlite3
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--clubs', action='store_true', help='Controleer eenmalig de openbare clublijst')
parser.add_argument('--omgeving', choices=['test', 'productie'], required=True)
args = parser.parse_args()
container = 'hockey-pocketbase-test' if args.omgeving == 'test' else 'hockey-pocketbase'
lock = open(ROOT / ('.catalogus-' + args.omgeving + '.lock'), 'w')
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit(0)

spec = importlib.util.spec_from_file_location('catalogus_meldingen', ROOT / 'scripts' / 'catalogus-meldingen.py')
notificaties = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notificaties)
spec = importlib.util.spec_from_file_location('catalogus_pilot', ROOT / 'scripts' / 'catalogus-pilot.py')
pilot_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot_module)
pilot_pad = ROOT / 'planning_documenten' / 'catalogus-pilot.db'
basis = ROOT / 'planning_documenten' / args.omgeving
pilot = pilot_module.Pilot(pilot_pad, args.omgeving) if (basis / 'catalogus-pilot.actief').is_file() and not args.clubs else None
# Test en productie bezoeken nooit tegelijkertijd de wedstrijdbron.
(ROOT / 'planning_documenten').mkdir(parents=True, exist_ok=True, mode=0o700)
bron_lock = open(ROOT / 'planning_documenten' / '.catalogus-bron.lock', 'a')
try:
    fcntl.flock(bron_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit(0)
bron_pad = ROOT / ('pb_test_data' if args.omgeving == 'test' else 'pb_data') / 'data.db'
meldingen = (notificaties.Meldingen(ROOT / 'planning_documenten' / args.omgeving / 'catalogus-mails.db', args.omgeving)
             if (ROOT / 'planning_documenten' / args.omgeving / 'catalogus-mails.actief').is_file() else None)

def controleer_meldingen():
    # Een restart na een geslaagde import mag geen update verliezen. Vergelijk ook
    # zonder nieuwe taken de duurzame vorige snapshot met de huidige catalogus.
    if meldingen:
        meldingen.controleer(notificaties.lees_catalogus(bron_pad))
        for taak in notificaties.lees_bronstatus(bron_pad):
            meldingen.bronresultaat(taak, 'Broncontrole mislukt' if taak['status'] == 'fout' else None)

controleer_meldingen()

def pb(*cmd):
    # PocketBase leest de bestaande sleutel zelf uit de containeromgeving.
    vlaggen = ['--encryptionEnv=PB_ENCRYPTION_KEY'] if args.omgeving == 'productie' else []
    return subprocess.run(['docker', 'exec', container, '/pb/pocketbase', *cmd, *vlaggen], check=True, capture_output=True, text=True).stdout

# CLI kan bootstrapmeldingen bevatten; alleen de JSON-lijst uitlezen.
regels = pb('catalogus-taken').splitlines()
taken = next((json.loads(r[r.index('['):]) for r in reversed(regels) if '[' in r), [])
if pilot:
    # Expliciet aangevraagde clubmetadata blijft beschikbaar voor aanmelden.
    # Alleen automatisch wedstrijdprogramma's van gekoppelde poules ophalen.
    clubs = [{**t,'sleutel':'club:'+t['clubBronId'],'slot':'expliciet:'+t['id']}
             for t in taken if not t['teamBronId'] and t['clubBronId']]
    taken = pilot.taken(pilot_module.geregistreerd(bron_pad)) + clubs[:1]
if args.clubs:
    taken = [{'id': '', 'clubBronId': '', 'teamBronId': '', 'pouleId': ''}]
for taak in taken:
    data = pilot.cache(taak) if pilot else None
    if pilot and data is None and not pilot.mag_ophalen():
        continue
    meting = pilot.begin(taak, 'cache' if data is not None else 'browser') if pilot else None
    if taak['id']:
        pb('catalogus-taakstatus', taak['id'], 'bezig')
    try:
        with tempfile.TemporaryDirectory(prefix='hockey-catalogus-') as d:
            Path(d).chmod(0o777)
            p = Path(d) / 'catalogus.json'
            if data is None:
                browser_herstel = (['-e', 'HOCKEY_BRON_BROWSER_HERSTEL=1']
                                   if pilot or (basis / 'catalogus-browser-herstel.actief').is_file() else [])
                subprocess.run(['docker', 'run', '--rm', '--network', 'host', '--cap-drop=ALL', '--security-opt=no-new-privileges:true', *browser_herstel, '-v', f'{ROOT / "scripts"}:/scripts:ro', '-v', f'{d}:/resultaat', 'zenika/alpine-chrome:with-puppeteer', 'node', '/scripts/catalogus-lees.cjs', taak['clubBronId'], taak['teamBronId'], taak['pouleId'], taak.get('seizoen', '')], check=True, timeout=150, capture_output=True)
                data = json.loads(p.read_text())
            aantal = pilot_module.wijzigingen(bron_pad, data) if pilot else 0
            data.pop('taakId', None)
            if taak['id']:
                data['taakId'] = taak['id']
            p.write_text(json.dumps(data))
            subprocess.run(['docker', 'exec', '-i', container, 'sh', '-c', 'cat > /tmp/catalogus.json'], input=p.read_bytes(), check=True, capture_output=True)
            resultaat = pb('catalogus-import', '/tmp/catalogus.json')
            if 'Catalogus bijgewerkt:' not in resultaat:
                raise ValueError('Import niet bevestigd: ' + resultaat[-500:])
            print(resultaat.strip())
            if meldingen:
                meldingen.bronresultaat(taak)
            if pilot:
                pilot.resultaat(meting, taak, data=data, aantal=aantal)
    except (subprocess.SubprocessError, ValueError, OSError) as exc:
        if taak['id']:
            pb('catalogus-taakstatus', taak['id'], 'fout')
        print('Openbare import mislukt; bestaande gegevens blijven behouden:', str(exc))
        if isinstance(exc, subprocess.CalledProcessError) and exc.stderr:
            print(exc.stderr.decode(errors='replace')[-500:] if isinstance(exc.stderr, bytes) else exc.stderr[-500:])
        fout = getattr(exc, 'stderr', '') or ''
        if isinstance(fout, bytes):
            fout = fout.decode(errors='replace')
        if meldingen:
            meldingen.bronresultaat(taak, fout or type(exc).__name__)
        if pilot:
            pilot.resultaat(meting, taak, fout=fout or type(exc).__name__)

controleer_meldingen()
try:
    if meldingen:
        pilot_module.plan_evaluatie(meldingen, basis, pilot_pad, bron_pad=bron_pad)
        notificaties.verzend_geconfigureerd(meldingen)
except (OSError, ValueError, KeyError, sqlite3.Error, subprocess.SubprocessError) as exc:
    # Mailconfig/SMTP-uitval mag geslaagde imports niet ongedaan maken; de
    # duurzame wachtrij wordt bij de volgende minuut opnieuw afgehandeld.
    print('Catalogusmeldingen wachten:', type(exc).__name__)
