"""Clubmetadata opnieuw proberen; uitsluitend read-only toegang tot de appdatabase."""
from datetime import datetime, timezone
from contextlib import closing
import json
import os
import re
import sqlite3
import time


def iso(moment):
    return datetime.fromtimestamp(moment, timezone.utc).isoformat(timespec='seconds')


def timestamp(waarde):
    try:
        return datetime.fromisoformat(waarde.replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, AttributeError):
        return 0


def beschikbaar(pad):
    with closing(sqlite3.connect(pad.resolve().as_uri() + '?mode=ro', uri=True)) as c:
        return 'opnieuwNa' in {r[1] for r in c.execute('PRAGMA table_info(catalogus_taken)')}


def taken(pad, nu=None):
    nu = time.time() if nu is None else nu
    with closing(sqlite3.connect(pad.resolve().as_uri() + '?mode=ro', uri=True)) as c:
        c.row_factory = sqlite3.Row
        rows = c.execute("SELECT id,clubBronId,status,updated,opnieuwNa,pogingen FROM catalogus_taken WHERE teamBronId='' AND clubBronId!='' AND status IN ('nieuw','fout','bezig') ORDER BY updated,id").fetchall()
        for row in rows:
            t = dict(row)
            if t['status'] == 'bezig' and timestamp(t['updated']) > nu - 600:
                continue
            if timestamp(t['opnieuwNa']) > nu:
                continue
            # Oude fouttaken krijgen ook automatisch een eerste herpoging.
            if t['status'] == 'fout' and not t['opnieuwNa'] and timestamp(t['updated']) + 300 > nu:
                continue
            return [{**t, 'teamBronId': '', 'pouleId': '', 'seizoen': '',
                     'sleutel': 'club:' + t['clubBronId'], 'slot': 'club:' + t['id'] + ':' + str(t['pogingen'] + 1)}]
    return []


def herpoging(pogingen, fout, bron_vanaf=0, nu=None):
    nu = time.time() if nu is None else nu
    # Eerst voorzichtig opbouwen, daarna maximaal één keer per zes uur.
    wachttijd = [300, 900, 1800, 3600, 21600][min(max(int(pogingen)-1, 0), 4)]
    code = re.search(r'Bron HTTP (\d{3})', fout or '')
    if code and code[1] in ('401', '403', '429'):
        wachttijd = max(wachttijd, 21600 if code[1] == '429' else 3600)
    retry = re.search(r'bronWachtTot=(\d+)', fout or '')
    return iso(max(nu + wachttijd, bron_vanaf, int(retry[1]) if retry else 0))


def publiceer(bestand, bron_vanaf=0, nu=None):
    nu = time.time() if nu is None else nu
    # Alleen de algemene wachttijd. Geen taken, privéteams, foutuitvoer of adressen publiceren.
    data = {'bijgewerkt': iso(nu), 'bronOpnieuwNa': iso(bron_vanaf) if bron_vanaf > nu else None}
    bestand.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tijdelijk = bestand.with_suffix('.tmp')
    fd = os.open(tijdelijk, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(data, f)
    tijdelijk.replace(bestand)
