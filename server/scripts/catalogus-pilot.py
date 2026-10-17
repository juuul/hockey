"""Begrensde poulepilot. Leest PocketBase alleen; schrijft eigen meet-/cachegegevens."""
from datetime import datetime
import html
import json
import os
from pathlib import Path
import re
import sqlite3
import time
from zoneinfo import ZoneInfo

ZONE = ZoneInfo('Europe/Amsterdam')
BRONVELDEN = ('datum', 'spelen', 'thuisBronId', 'uitBronId', 'thuisNaam', 'uitNaam', 'locatie', 'locatieAdres', 'status')


def geregistreerd(pad):
    with sqlite3.connect(pad.resolve().as_uri() + '?mode=ro', uri=True) as c:
        c.row_factory = sqlite3.Row
        rows = c.execute('''SELECT DISTINCT c.bronId AS teamBronId,c.clubBronId,c.seizoen,c.pouleId,c.spelvorm,
            k.id FROM catalogus_teams c JOIN teams t ON t.officieelTeam=c.id
            LEFT JOIN catalogus_taken k ON k.sleutel='team:'||c.bronId||':'||c.seizoen
            WHERE c.pouleId!='' ORDER BY c.bronId''').fetchall()
        poules = {}
        for row in rows:
            t = dict(row)
            key = ':'.join((t['seizoen'], t['spelvorm'], t['pouleId']))
            if key not in poules:
                poules[key] = {**t, 'id': t['id'] or '', 'sleutel': key}
        return list(poules.values())


def wijzigingen(pad, data):
    with sqlite3.connect(pad.resolve().as_uri() + '?mode=ro', uri=True) as c:
        c.row_factory = sqlite3.Row
        aantal = 0
        for w in data['wedstrijden']:
            oud = c.execute('SELECT * FROM catalogus_wedstrijden WHERE bronId=?', (w['bronId'],)).fetchone()
            if not oud or any((oud[k] or '') != (w.get(k) or '') for k in BRONVELDEN):
                aantal += 1
        return aantal


class Pilot:
    def __init__(self, pad, omgeving):
        pad.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.omgeving = omgeving
        self.c = sqlite3.connect(pad)
        os.chmod(pad, 0o600)
        self.c.executescript('''
            CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY,omgeving TEXT,sleutel TEXT,slot TEXT,
                begonnen REAL,klaar REAL,status TEXT,bron TEXT,code INTEGER,wijzigingen INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS cache(sleutel TEXT PRIMARY KEY,opgehaald REAL,inhoud TEXT);
            CREATE TABLE IF NOT EXISTS grenzen(sleutel TEXT PRIMARY KEY,waarde REAL);
        ''')

    def taken(self, poules, nu=None):
        nu = time.time() if nu is None else nu
        moment = datetime.fromtimestamp(nu, ZONE)
        middernacht = moment.replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
        for t in sorted(poules, key=lambda t: self.c.execute(
                'SELECT coalesce(max(begonnen),0) FROM runs WHERE omgeving=? AND sleutel=?',
                (self.omgeving,t['sleutel'])).fetchone()[0]):
            eerder = self.c.execute('SELECT 1 FROM runs WHERE omgeving=? AND sleutel=? LIMIT 1',
                                    (self.omgeving,t['sleutel'])).fetchone()
            # Ook een eerdere eerste opname of een oud avond-/ochtendslot telt
            # mee: een roosterwijziging mag niet nog een dagcontrole veroorzaken.
            gedaan = self.c.execute('''SELECT 1 FROM runs WHERE omgeving=? AND sleutel=?
                AND (slot=? OR (begonnen>=? AND begonnen<=?)) LIMIT 1''',
                (self.omgeving,t['sleutel'],'dag:'+moment.date().isoformat(),middernacht,nu)).fetchone()
            if gedaan or ((moment.hour,moment.minute)<(0,20) and eerder):
                continue
            gedeeld = self.c.execute("SELECT 1 FROM runs WHERE sleutel=? AND bron='browser' AND begonnen>=? AND begonnen<=? LIMIT 1", (t['sleutel'],middernacht,nu)).fetchone()
            # Een andere omgeving heeft deze poule vandaag al geprobeerd.
            # Gebruik haar broncache, of wacht na een mislukking tot morgen.
            if gedeeld and self.cache(t,nu) is None:
                continue
            return [{**t,'slot':'dag:'+moment.date().isoformat()}]
        return []

    def cache(self, taak, nu=None):
        nu = time.time() if nu is None else nu
        middernacht = datetime.fromtimestamp(nu,ZONE).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
        row = self.c.execute('SELECT inhoud FROM cache WHERE sleutel=? AND opgehaald>=?',
                             (taak['sleutel'],min(nu-7200,middernacht))).fetchone()
        return json.loads(row[0]) if row else None

    def mag_ophalen(self, nu=None):
        nu = time.time() if nu is None else nu
        grenzen = dict(self.c.execute('SELECT sleutel,waarde FROM grenzen'))
        laatste_klaar = self.c.execute("SELECT coalesce(max(klaar),0) FROM runs WHERE bron='browser'").fetchone()[0]
        # Ook na een lang bronbezoek twee volle seconden rust, gedeeld tussen omgevingen.
        if nu < grenzen.get('pauzeTot',0) or nu < max(grenzen.get('laatsteBezoek',0),laatste_klaar)+2:
            return False
        middernacht = datetime.fromtimestamp(nu,ZONE).replace(hour=0,minute=0,second=0,microsecond=0).timestamp()
        return self.c.execute("SELECT count(*) FROM runs WHERE bron='browser' AND begonnen>=?", (middernacht,)).fetchone()[0] < 24

    def begin(self, taak, bron, nu=None):
        nu = time.time() if nu is None else nu
        with self.c:
            r = self.c.execute('''INSERT INTO runs(omgeving,sleutel,slot,begonnen,status,bron)
                VALUES(?,?,?,?,'bezig',?)''', (self.omgeving,taak['sleutel'],taak['slot'],nu,bron))
            if bron == 'browser':
                self.c.execute('INSERT OR REPLACE INTO grenzen VALUES(?,?)', ('laatsteBezoek',nu))
        return r.lastrowid

    def resultaat(self, ident, taak, data=None, fout=None, aantal=0, nu=None):
        nu = time.time() if nu is None else nu
        code = re.search(r'Bron HTTP (\d{3})', fout or '')
        code = int(code[1]) if code else None
        with self.c:
            self.c.execute('UPDATE runs SET klaar=?,status=?,code=?,wijzigingen=? WHERE id=?',
                           (nu,'fout' if fout else 'klaar',code,aantal,ident))
            browser = self.c.execute('SELECT bron FROM runs WHERE id=?',(ident,)).fetchone()[0] == 'browser'
            if not fout and data is not None and browser:
                self.c.execute('INSERT OR REPLACE INTO cache VALUES(?,?,?)',
                               (taak['sleutel'],nu,json.dumps({k:v for k,v in data.items() if k != 'taakId'})))
            if code in (401,403,429):
                uitstel = re.search(r'bronWachtTot=(\d+)', fout)
                tot = max(nu + (21600 if code == 429 else 3600), int(uitstel[1]) if uitstel else 0)
                bestaand = self.c.execute("SELECT waarde FROM grenzen WHERE sleutel='pauzeTot'").fetchone()
                tot = max(tot,bestaand[0] if bestaand else 0)
                self.c.execute('INSERT OR REPLACE INTO grenzen VALUES(?,?)', ('pauzeTot',tot))

    def rapport(self, vanaf, tot, verwacht=None):
        rows = self.c.execute('''SELECT status,bron,code,wijzigingen FROM runs
            WHERE omgeving=? AND sleutel NOT LIKE 'club:%' AND begonnen>=? AND begonnen<=?''', (self.omgeving,vanaf,tot)).fetchall()
        goed = sum(r[0]=='klaar' for r in rows)
        fouten = sum(r[0]=='fout' for r in rows)
        beperkt = sum(r[2] in (401,403,429) for r in rows)
        gedeeld = self.c.execute("SELECT status,code FROM runs WHERE bron='browser' AND sleutel NOT LIKE 'club:%' AND begonnen>=? AND begonnen<=?", (vanaf,tot)).fetchall()
        bron_goed = sum(r[0]=='klaar' for r in gedeeld)
        bron_fout = sum(r[0]=='fout' for r in gedeeld)
        dekking = dict(self.c.execute("SELECT sleutel,count(*) FROM runs WHERE omgeving=? AND status='klaar' AND begonnen>=? AND begonnen<=? GROUP BY sleutel", (self.omgeving,vanaf,tot)))
        gedekt = verwacht is None or bool(verwacht) and all(dekking.get(k,0)>=5 for k in verwacht)
        genoeg = gedekt and goed >= 5 and len(rows) == goed and bron_goed >= 5 and len(gedeeld) == bron_goed and bron_fout == 0 and fouten == 0 and beperkt == 0
        advies = ('Een kleine uitbreiding naar meer geregistreerde poules is te overwegen; niet automatisch heel Nederland.' if genoeg
                  else 'Nog niet uitbreiden: eerst voldoende succesvolle controles en eventuele storingen onderzoeken.')
        if not rows:
            advies = 'Geen pilotmetingen beschikbaar. Controleer eerst of de productiepilot is geactiveerd; nog geen basis voor uitbreiding.'
        regels = [f'Afgeronde succesvolle controles: {goed}', f'Mislukte controles: {fouten}',
                  f'Controles nog bezig/afgebroken: {len(rows)-goed-fouten}',
                  f'Browserbezoeken: {sum(r[1]=="browser" for r in rows)}',
                  f'Hergebruik uit gedeelde poulecache: {sum(r[1]=="cache" for r in rows)}',
                  f'Gedeelde bronlaag (test en productie): {bron_goed} geslaagde en {bron_fout} mislukte browsercontroles',
                  f'Controles met toegangs-/limietfout: {beperkt}',
                  f'Gewijzigde/toegevoegde wedstrijdrecords bij geslaagde imports: {sum(r[3] for r in rows if r[0]=="klaar")}',
                  advies]
        poules = self.c.execute("SELECT count(DISTINCT sleutel) FROM runs WHERE omgeving=? AND sleutel NOT LIKE 'club:%' AND begonnen>=? AND begonnen<=?", (self.omgeving,vanaf,tot)).fetchone()[0]
        duur = self.c.execute("SELECT avg(klaar-begonnen),max(klaar-begonnen) FROM runs WHERE bron='browser' AND status='klaar' AND begonnen>=? AND begonnen<=?", (vanaf,tot)).fetchone()
        regels.insert(0,f'Geobserveerde geregistreerde poules in deze omgeving: {poules}')
        if verwacht is not None:
            regels.insert(0,f'Huidig aantal geregistreerde poules: {len(verwacht)}; met minstens vijf succesvolle controles: {sum(dekking.get(k,0)>=5 for k in verwacht)}')
        if duur[0] is not None:
            regels.insert(-1,f'Duur geslaagde browsercontroles inclusief import: gemiddeld {duur[0]:.1f} s, maximaal {duur[1]:.1f} s')
        return '<p>'+'</p><p>'.join(html.escape(r) for r in regels)+'</p>'


def plan_evaluatie(meldingen, basis, pilot_pad, nu=None, bron_pad=None):
    config = basis / 'catalogus-evaluatie.json'
    if not config.exists():
        return
    data = json.loads(config.read_text())
    nu = time.time() if nu is None else nu
    datum = datetime.fromisoformat(data['op'])
    vanaf = datetime.fromisoformat(data['vanaf'])
    if datum.utcoffset() is None or vanaf.utcoffset() is None:
        raise ValueError('Evaluatie vereist expliciete tijdzone')
    c = meldingen.c
    c.execute('CREATE TABLE IF NOT EXISTS evaluaties(id TEXT PRIMARY KEY,ingepland REAL)')
    if nu < datum.timestamp() or c.execute('SELECT 1 FROM evaluaties WHERE id=?',(data['id'],)).fetchone():
        return
    pilot = Pilot(pilot_pad, meldingen.omgeving)
    try:
        verwacht = [t['sleutel'] for t in geregistreerd(bron_pad)] if bron_pad else None
        rapport = pilot.rapport(vanaf.timestamp(),nu,verwacht)
    finally:
        pilot.c.close()
    prompt = ('Beoordeel de meetgegevens van de geregistreerde-poulepilot in de hockey-app. '
              'Onderzoek geslaagde controles, fouten, wachttijden en bronwijzigingen. Adviseer of een kleine uitbreiding verantwoord is. '
              'Gebruik alleen hockey.nl/KNHB; geen SCHC-site zonder mijn expliciete toestemming. '
              'Wijzig de omvang of zet code niet live zonder mijn goedkeuring.')
    inhoud = ('<p>De afgesproken evaluatie na een week. Er wordt niets automatisch uitgebreid.</p>'
              + '<p>Meetperiode: '+html.escape(data['vanaf'])+' tot '+html.escape(datetime.fromtimestamp(nu,ZONE).isoformat())+'</p>'
              + rapport + '<h3>Kopieer deze opdracht naar de chat</h3><pre style="white-space:pre-wrap">'
              + html.escape(prompt+'\n\nMeetperiode: '+data['vanaf']+' tot '+datum.isoformat()+'\n'+html.unescape(re.sub('<[^>]+>', '\n', rapport)))+'</pre>')
    with c:
        meldingen.voeg_toe('Evaluatie hockey-app · geregistreerde poules uitbreiden?', inhoud)
        c.execute('INSERT INTO evaluaties VALUES(?,?)',(data['id'],nu))
