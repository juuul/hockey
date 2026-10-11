#!/usr/bin/env python3
"""Verwerk openbare importverzoeken voor uitsluitend de gekozen omgeving.
Geen rechtstreeks schrijven naar sqlite, geen productiecredentials.
"""
import argparse
import fcntl
import json
from pathlib import Path
import subprocess
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

def pb(*cmd):
    return subprocess.run(['docker', 'exec', container, '/pb/pocketbase', *cmd], check=True, capture_output=True, text=True).stdout

# CLI kan bootstrapmeldingen bevatten; alleen de JSON-lijst uitlezen.
regels = pb('catalogus-taken').splitlines()
taken = next((json.loads(r[r.index('['):]) for r in reversed(regels) if '[' in r), [])
if args.clubs:
    taken = [{'id': '', 'clubBronId': '', 'teamBronId': '', 'pouleId': ''}]
for taak in taken:
    if taak['id']:
        pb('catalogus-taakstatus', taak['id'], 'bezig')
    try:
        with tempfile.TemporaryDirectory(prefix='hockey-catalogus-') as d:
            Path(d).chmod(0o777)
            subprocess.run(['docker', 'run', '--rm', '--network', 'host', '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '-v', f'{ROOT / "scripts"}:/scripts:ro', '-v', f'{d}:/resultaat', 'zenika/alpine-chrome:with-puppeteer', 'node', '/scripts/catalogus-lees.cjs', taak['clubBronId'], taak['teamBronId'], taak['pouleId'], taak.get('seizoen', '')], check=True, timeout=150, capture_output=True)
            p = Path(d) / 'catalogus.json'
            data = json.loads(p.read_text())
            if taak['id']:
                data['taakId'] = taak['id']
            p.write_text(json.dumps(data))
            subprocess.run(['docker', 'exec', '-i', container, 'sh', '-c', 'cat > /tmp/catalogus.json'], input=p.read_bytes(), check=True, capture_output=True)
            resultaat = pb('catalogus-import', '/tmp/catalogus.json')
            if 'Catalogus bijgewerkt:' not in resultaat:
                raise ValueError('Import niet bevestigd: ' + resultaat[-500:])
            print(resultaat.strip())
    except (subprocess.SubprocessError, ValueError, OSError) as exc:
        if taak['id']:
            pb('catalogus-taakstatus', taak['id'], 'fout')
        print('Openbare import mislukt; bestaande gegevens blijven behouden:', str(exc))
        if isinstance(exc, subprocess.CalledProcessError) and exc.stderr:
            print(exc.stderr.decode(errors='replace')[-500:] if isinstance(exc.stderr, bytes) else exc.stderr[-500:])
