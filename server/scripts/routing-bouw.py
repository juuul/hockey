#!/usr/bin/env python3
"""Eenmalig een eigen Nederlandse autorouter bouwen op openbare OSM-data."""
import json
from pathlib import Path
import subprocess
import time
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1] / 'routing_data'
root.mkdir(exist_ok=True)
controle = subprocess.run(['docker', 'inspect', '-f', '{{.State.Running}}', 'hockey-routing'], capture_output=True, text=True)
if controle.stdout.strip() == 'true':
    raise SystemExit('Stop eerst hockey-routing voordat je de routekaart herbouwt.')
url = 'https://download.geofabrik.de/europe/netherlands-latest.osm.pbf'
with urlopen(url, timeout=60) as response, open(root / 'netherlands.osm.pbf.download', 'wb') as target:
    bron = response.geturl()
    while data := response.read(4 * 1024 * 1024):
        target.write(data)
(root / 'netherlands.osm.pbf.download').replace(root / 'netherlands.osm.pbf')
# Beperkte CPU/RAM; de router moet tijdens herbouw uit staan.
for commando, extra in [('osrm-extract', ['-p', '/opt/car.lua']), ('osrm-partition', []), ('osrm-customize', [])]:
    pad = '/data/netherlands.osm.pbf' if commando == 'osrm-extract' else '/data/netherlands.osrm'
    subprocess.run(['docker', 'run', '--rm', '--cpus=3', '--memory=12g', '--memory-swap=13g', '-v', f'{root}:/data', 'ghcr.io/project-osrm/osrm-backend:v6.0.0', commando, '--threads', '3', *extra, pad], check=True)
(root / 'versie.json').write_text(json.dumps({'versie': 'osrm-6.0.0-' + str(int(time.time())), 'bron': bron}))
print('Routekaart opgebouwd. Start de routingcontainer met het eigen composebestand.')
