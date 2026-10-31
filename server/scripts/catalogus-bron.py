"""Private bronmetingen, een vaste browsersessie en begrensde opbouw van clubteams."""
from contextlib import closing
from datetime import datetime
import json
import os
from pathlib import Path
import sqlite3
import time
from zoneinfo import ZoneInfo

ZONE = ZoneInfo('Europe/Amsterdam')
ROUTES = {'bezoekersregistratie', 'clublijst', 'clubteams', 'teamprogramma', 'poule', 'overig'}
METHODES = {'GET', 'POST', 'OPTIONS', 'HEAD'}


def sessie_opties(basis):
    if not (basis / 'catalogus-browser-sessie.actief').is_file():
        return []
    profiel = basis / 'catalogus-browser-profiel'
    profiel.mkdir(mode=0o700, parents=True, exist_ok=True)
    profiel.chmod(0o700)
    return ['--user', f'{os.getuid()}:{os.getgid()}', '-e', 'HOCKEY_BRON_SESSIE=1',
            '-e', 'HOCKEY_BRON_BROWSER_HERSTEL=1', '-v', f'{profiel}:/bronprofiel']


def lees_meting(pad):
    try:
        d = json.loads(pad.read_text())
        if not isinstance(d, dict):
            return {}
    except (ValueError, OSError):
        return {}
    def getal(v):
        return min(max(v, 0), 10**12) if type(v) is int else 0
    uit = {k: getal(d.get(k)) for k in ['verzoeken', 'bronverzoeken', 'duurMs']}
    uit['afgekapt'] = d.get('afgekapt') is True
    uit['antwoorden'], uit['volgorde'] = [], []
    for veld in ['antwoorden', 'volgorde']:
        rows = d.get(veld, [])
        if not isinstance(rows, list):
            continue
        for r in rows[:100]:
            if not isinstance(r, dict) or r.get('route') not in ROUTES or r.get('methode') not in METHODES:
                continue
            if type(r.get('status')) is not int or not 100 <= r['status'] <= 599:
                continue
            record = {k: r[k] for k in ['route', 'methode', 'status']}
            if veld == 'antwoorden':
                record.update(aantal=getal(r.get('aantal')), retryNa=getal(r.get('retryNa')) or None)
            else:
                record['verzoek'] = getal(r.get('verzoek'))
            uit[veld].append(record)
    return uit


def controleer_meting(meting):
    # Een late nevenaanvraag kan na het gewenste antwoord nog een limiet melden.
    for r in meting.get('antwoorden', []):
        if r['status'] == 429:
            wacht = f"; bronWachtTot={r['retryNa']}" if r.get('retryNa') else ''
            raise ValueError(f"Bron HTTP 429; bronRoute={r['route']}{wacht}")


def bewaar_meting(pad, soort, status, meting, nu=None, omgeving='test'):
    nu = time.time() if nu is None else nu
    pad.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with closing(sqlite3.connect(pad)) as c:
        pad.chmod(0o600)
        c.execute('CREATE TABLE IF NOT EXISTS bezoeken(tijd REAL,soort TEXT,status TEXT,meting TEXT,omgeving TEXT)')
        with c:
            c.execute('INSERT INTO bezoeken VALUES(?,?,?,?,?)',
                      (nu, soort if soort in ('club', 'opbouw', 'poule', 'clublijst') else 'overig',
                       'klaar' if status == 'klaar' else 'fout', json.dumps(meting),
                       'productie' if omgeving == 'productie' else 'test'))
            c.execute('DELETE FROM bezoeken WHERE tijd<?', (nu - 30*86400,))


def stabiel(pad, nu):
    if not pad.is_file():
        return False
    with closing(sqlite3.connect(pad.resolve().as_uri() + '?mode=ro', uri=True)) as c:
        rows = c.execute('SELECT status,meting FROM bezoeken WHERE tijd>=? ORDER BY tijd DESC,rowid DESC LIMIT 5',
                         (nu - 7*86400,)).fetchall()
    if len(rows) != 5:
        return False
    for status, tekst in rows:
        d = json.loads(tekst)
        if status != 'klaar' or not d.get('bronverzoeken') or d.get('afgekapt'):
            return False
        if any(r['status'] in (403, 429) for r in d.get('antwoorden', [])):
            return False
    return True


def opbouw_taken(pad, pilot, meting_pad, nu=None):
    """Alleen metadata; geen programma's van ongeregistreerde poules ophalen."""
    nu = time.time() if nu is None else nu
    if not stabiel(meting_pad, nu):
        return []
    laatste = pilot.c.execute("SELECT status FROM runs WHERE bron='browser' AND begonnen>=? ORDER BY begonnen DESC,id DESC LIMIT 5", (nu - 7*86400,)).fetchall()
    if len(laatste) != 5 or any(r[0] != 'klaar' for r in laatste):
        return []
    moment = datetime.fromtimestamp(nu, ZONE)
    jaar = moment.year - (moment.month < 7)
    seizoen = f'{jaar}-{jaar+1}'
    vers = max(nu - 30*86400, datetime(jaar, 7, 1, tzinfo=ZONE).timestamp())
    dag = moment.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    p = pilot.c
    opbouw = p.execute("SELECT begonnen FROM runs WHERE bron='browser' AND slot LIKE 'opbouw:%' AND begonnen>=? ORDER BY begonnen DESC", (dag,)).fetchall()
    if len(opbouw) >= 4 or (opbouw and opbouw[0][0] + 1800 > nu):
        return []
    with closing(sqlite3.connect(pad.resolve().as_uri() + '?mode=ro', uri=True)) as c:
        clubs = c.execute('SELECT bronId FROM catalogus_clubs ORDER BY bronId').fetchall()
    kandidaten = []
    for (club,) in clubs:
        # Alleen de broncodes die ook de browserlezer toelaat.
        if len(club) != 7 or not club.isascii() or not club.isalnum() or club != club.upper():
            continue
        key = 'club:' + club
        laatst = p.execute("SELECT coalesce(max(begonnen),0) FROM runs WHERE omgeving=? AND sleutel=? AND status='klaar'", (pilot.omgeving, key)).fetchone()[0]
        if pilot.club_vanaf(key) > nu:
            continue
        recent = p.execute("SELECT max(begonnen) FROM runs WHERE sleutel=? AND bron='browser' AND status!='klaar' AND begonnen>=?", (key, dag)).fetchone()[0]
        if recent is not None:
            continue
        row = p.execute('SELECT inhoud,opgehaald FROM cache WHERE sleutel=? AND opgehaald>=?', (key, vers)).fetchone()
        data = json.loads(row[0]) if row else None
        if data is not None and any(t.get('seizoen') != seizoen for t in data.get('teams', [])):
            data = None
        lokaal = p.execute("SELECT coalesce(max(klaar),0) FROM runs WHERE omgeving=? AND sleutel=? AND status='klaar'", (pilot.omgeving, key)).fetchone()[0]
        if data is not None and lokaal >= row[1]:
            continue
        # Metadata uit de gedeelde cache eerst verspreiden, zonder bronverzoek.
        kandidaten.append((data is None, laatst, club, data))
    if not kandidaten:
        return []
    _, _, club, data = min(kandidaten, key=lambda k: (k[0], k[1], k[2]))
    return [{'id': '', 'clubBronId': club, 'teamBronId': '', 'pouleId': '', 'seizoen': seizoen,
             'sleutel': 'club:' + club, 'slot': 'opbouw:' + seizoen, 'opbouw': True, 'cacheData': data}]
