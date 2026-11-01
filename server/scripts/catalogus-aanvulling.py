"""Een expliciet aangevraagde, hervatbare ronde van openbare clubteamlijsten."""
from contextlib import closing
from datetime import datetime
import html
import json
import os
from pathlib import Path
import re
import sqlite3
import time
from zoneinfo import ZoneInfo


def configuratie(basis):
    pad = basis / 'catalogus-aanvulling.json'
    if not pad.exists():
        return None
    d = json.loads(pad.read_text())
    if not re.fullmatch(r'[a-z0-9-]{1,80}', d.get('id', '')) or not re.fullmatch(r'\d{4}-\d{4}', d.get('seizoen', '')):
        raise ValueError('Ongeldige aanvulronde')
    a, b = map(int, d['seizoen'].split('-'))
    if b != a + 1:
        raise ValueError('Ongeldig seizoen')
    for marker in ['catalogus-pilot.actief', 'catalogus-browser-sessie.actief', 'catalogus-clubs-licht.actief']:
        if not (basis / marker).is_file():
            raise ValueError('Aanvulling vereist de lichte bronroute en bronbegrenzing')
    return {'id': d['id'], 'seizoen': d['seizoen']}


class Aanvulling:
    def __init__(self, pad, omgeving, config):
        self.omgeving, self.config = omgeving, config
        self.key = config['id'] + ':' + omgeving
        pad.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.c = sqlite3.connect(pad)
        self.c.row_factory = sqlite3.Row
        pad.chmod(0o600)
        self.c.executescript('''
            CREATE TABLE IF NOT EXISTS rondes(id TEXT PRIMARY KEY,seizoen TEXT,status TEXT,
                lijst INTEGER DEFAULT 0,pogingen INTEGER DEFAULT 0,vanaf REAL DEFAULT 0,afgerond REAL);
            CREATE TABLE IF NOT EXISTS clubs(ronde TEXT,bronId TEXT,naam TEXT,status TEXT,
                pogingen INTEGER DEFAULT 0,vanaf REAL DEFAULT 0,klaar REAL,
                PRIMARY KEY(ronde,bronId));
        ''')
        with self.c:
            self.c.execute("INSERT OR IGNORE INTO rondes(id,seizoen,status) VALUES(?,?,'bezig')", (self.key, config['seizoen']))
        if self.c.execute('SELECT seizoen FROM rondes WHERE id=?', (self.key,)).fetchone()[0] != config['seizoen']:
            raise ValueError('Een bestaande ronde krijgt geen ander seizoen')

    @property
    def actief(self):
        return self.c.execute('SELECT status FROM rondes WHERE id=?', (self.key,)).fetchone()[0] != 'gereed'

    def _taak(self, club='', naam='', cache=None):
        return {'id': '', 'clubBronId': club, 'teamBronId': '', 'pouleId': '',
                'seizoen': self.config['seizoen'], 'sleutel': 'club:' + club if club else 'clublijst',
                'slot': 'aanvulling:' + self.key + ':' + (club or 'clublijst'),
                'naam': naam or 'landelijke clublijst', 'aanvulling': True, 'cacheData': cache}

    def taken(self, pilot, nu=None):
        nu = time.time() if nu is None else nu
        ronde = self.c.execute('SELECT * FROM rondes WHERE id=?', (self.key,)).fetchone()
        if ronde['status'] == 'gereed' or ronde['vanaf'] > nu:
            return []
        laatst = pilot.c.execute("SELECT coalesce(max(begonnen),0) FROM runs WHERE bron='browser'").fetchone()[0]
        if not ronde['lijst']:
            data = pilot.cache({'sleutel': 'clublijst'}, nu)
            return [self._taak(cache=data)] if data is not None or laatst + 300 <= nu else []
        seizoen_start = datetime(int(self.config['seizoen'][:4]), 7, 1, tzinfo=ZoneInfo('Europe/Amsterdam')).timestamp()
        vers = max(nu - 30*86400, seizoen_start)
        kandidaten = []
        for row in self.c.execute("SELECT * FROM clubs WHERE ronde=? AND status!='klaar' AND vanaf<=? ORDER BY pogingen,bronId", (self.key, nu)):
            key = 'club:' + row['bronId']
            if pilot.club_vanaf(key) > nu:
                continue
            r = pilot.c.execute('SELECT inhoud FROM cache WHERE sleutel=? AND opgehaald>=?', (key, vers)).fetchone()
            data = json.loads(r[0]) if r else None
            if data is not None and any(t.get('seizoen') != self.config['seizoen'] for t in data.get('teams', [])):
                data = None
            if data is None and laatst + 300 > nu:
                continue
            kandidaten.append((data is None, row['pogingen'], row['bronId'], row['naam'], data))
        if not kandidaten:
            return []
        _, _, club, naam, data = min(kandidaten, key=lambda r: r[:3])
        return [self._taak(club, naam, data)]

    def valideer(self, taak, data, bron_pad):
        if not taak['clubBronId']:
            clubs = data.get('clubs', [])
            ids = [r.get('bronId', '') for r in clubs]
            with closing(sqlite3.connect(bron_pad.resolve().as_uri() + '?mode=ro', uri=True)) as c:
                bestaand = c.execute('SELECT count(*) FROM catalogus_clubs').fetchone()[0]
            if (not clubs or len(clubs) > 1000 or len(set(ids)) != len(ids)
                    or any(not re.fullmatch(r'[A-Z0-9]{7}', i) for i in ids)
                    or len(clubs) < bestaand * 0.8):
                raise ValueError('Onverwacht onvolledige clublijst; bestaande catalogus behouden')
        elif (not any(c.get('bronId') == taak['clubBronId'] for c in data.get('clubs', []))
              or any(t.get('clubBronId') != taak['clubBronId'] or t.get('seizoen') != self.config['seizoen'] for t in data.get('teams', []))):
            raise ValueError('Clubantwoord past niet bij de aangevraagde club of het seizoen')
        if data.get('wedstrijden'):
            raise ValueError('Deze ronde haalt alleen clubteamlijsten op')

    def resultaat(self, taak, data=None, fout=None, bron_vanaf=0, nu=None):
        nu = time.time() if nu is None else nu
        club = taak['clubBronId']
        with self.c:
            if fout:
                tabel, veld, ident = ('clubs', 'bronId', club) if club else ('rondes', 'id', self.key)
                extra = ' AND ronde=?' if club else ''
                params = (ident, self.key) if club else (ident,)
                aantal = self.c.execute(f'SELECT pogingen FROM {tabel} WHERE {veld}=?{extra}', params).fetchone()[0] + 1
                vanaf = max(nu + min(21600, 300 * 2**min(aantal-1, 7)), bron_vanaf)
                self.c.execute(f"UPDATE {tabel} SET pogingen=?,vanaf=?,status='fout' WHERE {veld}=?{extra}", (aantal, vanaf, *params))
                return
            if club:
                self.c.execute("UPDATE clubs SET status='klaar',klaar=?,vanaf=0 WHERE ronde=? AND bronId=?", (nu, self.key, club))
            else:
                for c in data['clubs']:
                    self.c.execute("INSERT OR IGNORE INTO clubs(ronde,bronId,naam,status) VALUES(?,?,?,'nieuw')", (self.key, c['bronId'], c.get('naam', '')))
                self.c.execute("UPDATE rondes SET lijst=1,status='bezig',vanaf=0 WHERE id=?", (self.key,))
            over = self.c.execute("SELECT count(*) FROM clubs WHERE ronde=? AND status!='klaar'", (self.key,)).fetchone()[0]
            totaal = self.c.execute('SELECT count(*) FROM clubs WHERE ronde=?', (self.key,)).fetchone()[0]
            if totaal and not over:
                self.c.execute("UPDATE rondes SET status='gereed',afgerond=? WHERE id=?", (nu, self.key))

    def publiceer(self, pad):
        r = self.c.execute('SELECT status,afgerond FROM rondes WHERE id=?', (self.key,)).fetchone()
        counts = dict(self.c.execute('SELECT status,count(*) FROM clubs WHERE ronde=? GROUP BY status', (self.key,)))
        data = {'ronde': self.config['id'], 'seizoen': self.config['seizoen'], 'status': r['status'],
                'totaal': sum(counts.values()), 'klaar': counts.get('klaar', 0), 'fouten': counts.get('fout', 0), 'afgerond': r['afgerond']}
        tmp = pad.with_suffix('.tmp')
        fd = os.open(tmp, os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as f: json.dump(data, f)
        tmp.replace(pad)

    def meld_gereed(self, meldingen, bron_pad):
        if self.actief:
            return
        c = meldingen.c
        key = 'clubaanvulling:' + self.key
        c.execute('CREATE TABLE IF NOT EXISTS evaluaties(id TEXT PRIMARY KEY,ingepland REAL)')
        if c.execute('SELECT 1 FROM evaluaties WHERE id=?', (key,)).fetchone():
            return
        aantal = self.c.execute('SELECT count(*) FROM clubs WHERE ronde=?', (self.key,)).fetchone()[0]
        with closing(sqlite3.connect(bron_pad.resolve().as_uri() + '?mode=ro', uri=True)) as bron:
            teams = bron.execute('SELECT count(*) FROM catalogus_teams WHERE seizoen=?', (self.config['seizoen'],)).fetchone()[0]
        inhoud = (f'<p>De aangevraagde aanvulronde is afgerond: {aantal} clubteamlijsten verwerkt. '
                  f'De catalogus bevat {teams} teams voor seizoen {html.escape(self.config["seizoen"])}.</p>'
                  '<p>Deze ronde stopt nu. Alleen de bestaande dagelijkse controles van geregistreerde poules blijven doorlopen. '
                  'Wedstrijdprogramma’s van overige teams zijn niet automatisch opgehaald.</p>')
        with c:
            meldingen.voeg_toe('Hockey-app · clubteamlijsten aangevuld', inhoud)
            c.execute('INSERT INTO evaluaties VALUES(?,?)', (key, time.time()))
