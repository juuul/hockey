#!/usr/bin/env python3
"""Bereken alleen bekende openbare club/accommodatieparen, geen privéadressen."""
import argparse
import fcntl
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--omgeving', choices=['test', 'productie'], required=True)
parser.add_argument('--testcontainer', help='Alleen een geïsoleerde testcontainer')
args = parser.parse_args()
container = 'hockey-pocketbase-test' if args.omgeving == 'test' else 'hockey-pocketbase'
if args.testcontainer:
    if args.omgeving != 'test' or args.testcontainer == 'hockey-pocketbase':
        parser.error('Testcontainer kan alleen voor de testomgeving')
    subprocess.run(['docker', 'exec', args.testcontainer, 'sh', '-c', 'test "$HOCKEY_ENV" = test'], check=True, capture_output=True)
    container = args.testcontainer
lock = open(ROOT / ('.reis-' + args.omgeving + '.lock'), 'w')
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit(0)

def pb(*cmd):
    flags = ['--encryptionEnv=PB_ENCRYPTION_KEY'] if args.omgeving == 'productie' else []
    return subprocess.run(['docker', 'exec', container, '/pb/pocketbase', *cmd, *flags], check=True, capture_output=True, text=True).stdout

def request(url):
    with urlopen(Request(url, headers={'User-Agent': 'HockeyWisselapp/1.0 (+https://hockey.juliaan.eu/)'}), timeout=20) as r:
        return json.load(r)

def geocode(adres):
    postcode = re.search(r'\b(\d{4})\s?([A-Za-z]{2})\b', adres)
    if not postcode:
        raise ValueError('Geen Nederlandse postcode in bronadres')
    prefix = adres[:postcode.start()].strip(' ,')
    huis = re.search(r'^(.*?)\s+(\d+)\s*([A-Za-z0-9-]*)$', prefix)
    if not huis:
        raise ValueError('Geen volledig straatadres in bron')
    pc = (postcode[1] + postcode[2]).upper()
    params = [('q', '*'), ('fq', 'type:adres'), ('fq', 'postcode:' + pc), ('fq', 'huisnummer:' + huis[2]), ('rows', '20')]
    docs = request('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?' + urlencode(params))['response']['docs']
    canon = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
    kandidaten = [d for d in docs if canon(d.get('straatnaam', '')) == canon(huis[1]) and canon(str(d.get('huisletter', '')) + str(d.get('huisnummertoevoeging', ''))) == canon(huis[3])]
    if len(kandidaten) != 1:
        raise ValueError('Adres niet eenduidig gevonden in PDOK/BAG')
    punt = re.fullmatch(r'POINT\(([-\d.]+) ([-\d.]+)\)', kandidaten[0]['centroide_ll'])
    if not punt:
        raise ValueError('Geen bruikbaar adrespunt')
    return {'lon': float(punt[1]), 'lat': float(punt[2])}

def voeruit():
    # Eerst controleren of de eigen router beschikbaar is: nooit fouten opslaan
    # omdat de kaart nog wordt voorbereid of de container tijdelijk uit staat.
    request('http://127.0.0.1:5001/nearest/v1/driving/5.19879,52.13526?number=1')
    sync = pb('reis-synchroniseer')
    if 'REIS_SYNC_OK' not in sync:
        raise ValueError('Locatiesynchronisatie niet bevestigd')
    regels = pb('reis-taken').splitlines()
    taken = next((json.loads(r[r.index('['):]) for r in reversed(regels) if '[' in r), [])
    locaties, routes, punten, fouten = [], [], {}, {}
    kaart = json.loads((ROOT / 'routing_data' / 'versie.json').read_text())['versie']
    for taak in taken:
        try:
            for kant in ['vertrek', 'bestemming']:
                l = taak[kant]
                if l['id'] in fouten:
                    raise ValueError(fouten[l['id']])
                if l['id'] not in punten:
                    try:
                        punten[l['id']] = l.get('punt') or geocode(l['adres'])
                        if not l.get('punt'):
                            locaties.append({'id': l['id'], 'punt': punten[l['id']]})
                            time.sleep(1)
                    except (ValueError, KeyError) as exc:
                        fouten[l['id']] = str(exc)
                        raise
            a, b = punten[taak['vertrek']['id']], punten[taak['bestemming']['id']]
            route = request(f"http://127.0.0.1:5001/route/v1/driving/{a['lon']},{a['lat']};{b['lon']},{b['lat']}?overview=false&steps=false&radiuses=300;300")
            if route.get('code') != 'Ok' or not route.get('routes'):
                raise ValueError('Geen autoroute gevonden')
            routes.append({'id': taak['id'], 'seconden': route['routes'][0]['duration'], 'kaartVersie': kaart})
        except (ValueError, KeyError) as exc:
            routes.append({'id': taak['id'], 'fout': str(exc)})
        except OSError:
            # Tijdelijke netwerkfout blijft in de wachtrij; geen fictieve 0 minuten.
            continue
    if not routes and not locaties:
        print('Geen nieuwe reispaarberekeningen'); return
    data = json.dumps({'locaties': locaties, 'routes': routes}).encode()
    subprocess.run(['docker', 'exec', '-i', container, 'sh', '-c', 'cat > /tmp/reis-import.json'], input=data, check=True, capture_output=True)
    result = pb('reis-import', '/tmp/reis-import.json')
    if 'REIS_IMPORT_OK' not in result:
        raise ValueError('Reisimport niet bevestigd')
    print('Reistijden verwerkt:', len(routes), 'paren;', sum('fout' not in r for r in routes), 'geslaagd')

try:
    voeruit()
except (OSError, ValueError, subprocess.SubprocessError) as exc:
    print('Reiswerker niet voltooid; bestaande reistijden blijven behouden:', type(exc).__name__)
