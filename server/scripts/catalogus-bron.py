"""Private bronmetingen, een vaste browsersessie en begrensde opbouw van clubteams."""
from contextlib import closing
from datetime import datetime
import html
import json
import os
from pathlib import Path
import sqlite3
import time
from zoneinfo import ZoneInfo

ZONE = ZoneInfo('Europe/Amsterdam')
ROUTES = {'bezoekersregistratie', 'clublijst', 'clubteams', 'teamprogramma', 'poule', 'overig',
          'standaardfavorieten', 'standaardwedstrijden'}
METHODES = {'GET', 'POST', 'OPTIONS', 'HEAD'}


def sessie_opties(basis):
    if not (basis / 'catalogus-browser-sessie.actief').is_file():
        return []
    profiel = basis / 'catalogus-browser-profiel'
    profiel.mkdir(mode=0o700, parents=True, exist_ok=True)
    profiel.chmod(0o700)
    opties = ['--user', f'{os.getuid()}:{os.getgid()}', '-e', 'HOCKEY_BRON_SESSIE=1',
              '-e', 'HOCKEY_BRON_BROWSER_HERSTEL=1', '-v', f'{profiel}:/bronprofiel']
    if (basis / 'catalogus-poule-licht.actief').is_file():
        opties += ['-e', 'HOCKEY_BRON_POULE_LICHT=1']
    if (basis / 'catalogus-clubs-licht.actief').is_file():
        opties += ['-e', 'HOCKEY_BRON_CLUBS_LICHT=1']
    return opties


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
    uit['werkwijze'] = 'licht' if d.get('werkwijze') == 'licht' else 'website'
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


def plan_lichte_evaluatie(meldingen, basis, meting_pad, nu=None):
    """Eén op verzoek ingepland meetoverzicht, via de bestaande mailwachtrij."""
    config = basis / 'catalogus-licht-evaluatie.json'
    if not config.exists():
        return
    d = json.loads(config.read_text())
    vanaf, op = datetime.fromisoformat(d['vanaf']), datetime.fromisoformat(d['op'])
    if vanaf.utcoffset() is None or op.utcoffset() is None or op < vanaf:
        raise ValueError('Evaluatie vereist een geldige periode met tijdzone')
    nu = time.time() if nu is None else nu
    if nu < op.timestamp():
        return
    sleutel = 'lichte-poule:' + str(d['id'])
    c = meldingen.c
    c.execute('CREATE TABLE IF NOT EXISTS evaluaties(id TEXT PRIMARY KEY,ingepland REAL)')
    if c.execute('SELECT 1 FROM evaluaties WHERE id=?', (sleutel,)).fetchone():
        return
    regels = []
    if meting_pad.exists():
        with closing(sqlite3.connect(meting_pad.resolve().as_uri() + '?mode=ro', uri=True)) as bron:
            rows = bron.execute("SELECT tijd,status,meting,omgeving FROM bezoeken WHERE soort='poule' AND tijd>=? AND tijd<=? ORDER BY tijd", (vanaf.timestamp(), nu)).fetchall()
        for tijd, status, tekst, omgeving in rows:
            meting = json.loads(tekst)
            if meting.get('werkwijze') != 'licht':
                continue
            regels.append(f"{datetime.fromtimestamp(tijd, ZONE).strftime('%d-%m %H:%M:%S')} · {omgeving} · {'import geslaagd' if status == 'klaar' else 'controle mislukt'} · {meting.get('verzoeken', 0)} webverzoeken, waarvan {meting.get('bronverzoeken', 0)} aan de wedstrijdbron")
            for r in meting.get('antwoorden', []):
                if r.get('route') in ROUTES and r.get('methode') in METHODES and type(r.get('status')) is int:
                    regels.append(f"  {r['route']} · {r['methode']} · HTTP {r['status']} · {r.get('aantal', 0)} keer")
    uitleg = '\n'.join(regels) if regels else 'Nog geen lichte broncontrole gemeten in deze periode. Er is geen extra bronverzoek gestart voor deze evaluatie; bronpauzes en planning blijven gelden.'
    periode = vanaf.isoformat() + ' tot ' + datetime.fromtimestamp(nu, ZONE).isoformat()
    prompt = ('Beoordeel de lichte poulecontrole van de hockey-app aan de hand van deze metingen. '
              'Controleer bronstatus, bezoekersregistraties, aantal verzoeken en bevestigde imports. '
              'Vergelijk met de eerdere websitecontrole. Een geslaagde controle bewijst nog niet dat 429 definitief is opgelost. '
              'Respecteer bronpauzes, behouden eigen planning en gebruik alleen hockey.nl/KNHB; geen SCHC-site zonder mijn expliciete toestemming. '
              'Wijzig code of ophaallimieten niet zonder mijn opdracht.\n\nMeetperiode: ' + periode + '\n' + uitleg)
    inhoud = ('<p>Het ingeplande overzicht van de lichte programmacontrole. Test en productie delen bronbezoeken en cache; hieronder staan alleen echte bronbezoeken.</p><p>Meetperiode: '
              + html.escape(periode) + '</p><pre style="white-space:pre-wrap">' + html.escape(uitleg)
              + '</pre><h3>Kopieer deze opdracht naar de chat</h3><pre style="white-space:pre-wrap">' + html.escape(prompt) + '</pre>')
    with c:
        meldingen.voeg_toe('Evaluatie hockey-app · lichte programmacontrole', inhoud)
        c.execute('INSERT INTO evaluaties VALUES(?,?)', (sleutel, nu))
