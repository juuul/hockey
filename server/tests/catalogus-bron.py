import importlib.util
from pathlib import Path
import json
import sqlite3
import tempfile
import unittest
from datetime import datetime


def module(naam):
    spec = importlib.util.spec_from_file_location(naam, Path(__file__).parents[1]/'scripts'/naam)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


m = module('catalogus-bron.py')
p = module('catalogus-pilot.py')


class BronTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.now = datetime(2026, 10, 31, 14, tzinfo=m.ZONE).timestamp()
        self.db = self.root/'data.db'
        with sqlite3.connect(self.db) as c:
            c.executescript("CREATE TABLE catalogus_clubs(bronId TEXT); INSERT INTO catalogus_clubs VALUES('AAA0001'),('BBB0002'),('CCC0003'),('DDD0004'),('EEE0005');")
        self.pilot = p.Pilot(self.root/'pilot.db', 'test'); self.addCleanup(self.pilot.c.close)
        self.metingen = self.root/'metingen.db'

    def bezoek(self, key='poule:123', status='klaar', nu=None, slot='dag', bron='browser'):
        nu = self.now-10000 if nu is None else nu
        t = {'sleutel':key, 'slot':slot}
        ident = self.pilot.begin(t, bron, nu)
        if status != 'bezig':
            self.pilot.resultaat(ident, t, data={'clubs':[], 'teams':[], 'wedstrijden':[]} if status == 'klaar' else None,
                                 fout=None if status == 'klaar' else 'Bron HTTP 429', nu=nu+1)
        m.bewaar_meting(self.metingen, 'poule', status, {'bronverzoeken':2, 'antwoorden':[]}, nu)

    def stabiel(self):
        for i in range(5): self.bezoek(nu=self.now-600-i*60)

    def taken(self, nu=None):
        return m.opbouw_taken(self.db, self.pilot, self.metingen, self.now if nu is None else nu)

    def test_profile_opt_in_private_and_persistent(self):
        self.assertEqual(m.sessie_opties(self.root), [])
        (self.root/'catalogus-browser-sessie.actief').touch()
        args = m.sessie_opties(self.root)
        profiel = self.root/'catalogus-browser-profiel'
        (profiel/'bestaande-sessie').write_text('behouden')
        self.assertEqual(args, m.sessie_opties(self.root))
        self.assertTrue((profiel/'bestaande-sessie').exists())
        self.assertEqual(profiel.stat().st_mode & 0o777, 0o700)

    def test_metrics_whitelist_permissions_and_retention(self):
        f = self.root/'bronmeting.json'
        f.write_text(json.dumps({'token':'GEHEIM', 'verzoeken':5, 'bronverzoeken':2,
          'antwoorden':[{'route':'clubteams', 'methode':'GET', 'status':429, 'aantal':1, 'retryNa':123, 'headers':{'authorization':'GEHEIM'}},
                        {'route':'/email/GEHEIM', 'methode':'POST', 'status':200}],
          'volgorde':[{'route':'clubteams', 'methode':'GET', 'status':429, 'verzoek':2, 'body':'GEHEIM'}]}))
        d = m.lees_meting(f)
        self.assertNotIn('GEHEIM', json.dumps(d)); self.assertEqual(len(d['antwoorden']), 1)
        self.assertEqual(d['volgorde'][0]['verzoek'], 2)
        m.bewaar_meting(self.metingen, 'club', 'fout', d, self.now-31*86400)
        m.bewaar_meting(self.metingen, 'club', 'fout', d, self.now)
        with sqlite3.connect(self.metingen) as c: self.assertEqual(c.execute('SELECT count(*) FROM bezoeken').fetchone()[0], 1)
        self.assertEqual(self.metingen.stat().st_mode & 0o777, 0o600)

    def test_five_recent_successes_required_and_no_app_writes(self):
        self.assertEqual(self.taken(), [])
        for i in range(4): self.bezoek(nu=self.now-600-i*60)
        self.assertEqual(self.taken(), [])
        self.bezoek(nu=self.now-300)
        voor = self.db.read_bytes()
        taak = self.taken()[0]
        self.assertEqual((taak['clubBronId'], taak['teamBronId'], taak['pouleId']), ('AAA0001','',''))
        self.assertEqual(self.db.read_bytes(), voor)
        self.assertTrue(taak['opbouw'])
        self.assertEqual(self.taken(self.now+8*86400), [], 'Oude meetgegevens zijn geen bewijs van huidige stabiliteit')

    def test_failure_in_either_environment_stops_expansion(self):
        self.stabiel(); self.assertTrue(self.taken())
        other = p.Pilot(self.root/'pilot.db','productie'); self.addCleanup(other.c.close)
        ident = other.begin({'sleutel':'club:BBB0002','slot':'expliciet'}, 'browser', self.now-30)
        other.resultaat(ident, {'sleutel':'club:BBB0002'}, fout='Bron HTTP 429', nu=self.now-29)
        self.assertEqual(self.taken(), [])

    def test_success_with_hidden_429_still_stops_expansion(self):
        self.stabiel()
        m.bewaar_meting(self.metingen, 'club', 'klaar', {'bronverzoeken':2, 'antwoorden':[{'status':429}]}, self.now-1)
        self.assertEqual(self.taken(), [])
        with self.assertRaisesRegex(ValueError, 'Bron HTTP 429; bronRoute=overig; bronWachtTot=12345'):
            m.controleer_meting({'antwoorden':[{'status':429, 'route':'overig', 'retryNa':12345}]})

    def test_four_per_day_and_thirty_minutes_between_bulk_visits(self):
        self.stabiel()
        self.bezoek('club:AAA0001', nu=self.now-1799, slot='opbouw:2026-2027')
        self.assertEqual(self.taken(), [])
        self.assertTrue(self.taken(self.now+1))
        for i in range(3): self.bezoek(f'club:{i}', nu=self.now-3600-i*60, slot='opbouw:2026-2027')
        self.assertEqual(self.taken(), [])

    def test_shared_cache_without_revisit_then_monthly_and_season_refresh(self):
        self.stabiel()
        # Een andere omgeving heeft deze club al volledig geladen.
        self.pilot.c.execute('INSERT INTO cache VALUES(?,?,?)', ('club:BBB0002',self.now-1000,
             json.dumps({'clubs':[], 'teams':[{'seizoen':'2026-2027'}], 'wedstrijden':[]})))
        self.pilot.c.commit()
        taak = self.taken()[0]
        self.assertEqual(taak['clubBronId'],'BBB0002'); self.assertIsNotNone(taak['cacheData'])
        self.bezoek('club:BBB0002', nu=self.now-120, slot='opbouw:2026-2027', bron='cache')
        self.assertEqual(self.taken()[0]['clubBronId'],'AAA0001')
        self.pilot.wacht_club('club:AAA0001',self.now+10000)
        self.assertEqual(self.taken()[0]['clubBronId'],'CCC0003')
        # De cache van vorig seizoen is nooit een actuele teamlijst.
        self.pilot.c.execute('UPDATE cache SET inhoud=?', (json.dumps({'teams':[{'seizoen':'2025-2026'}]}),)); self.pilot.c.commit()
        self.pilot.c.execute("DELETE FROM runs WHERE sleutel='club:BBB0002'"); self.pilot.c.commit()
        self.assertIsNone(self.taken()[0]['cacheData'])

    def test_never_loaded_clubs_before_monthly_refresh(self):
        self.stabiel()
        self.bezoek('club:AAA0001', nu=self.now-31*86400)
        # Een oude meting verandert de recente succesvolle reeks niet.
        self.assertEqual(self.taken()[0]['clubBronId'], 'BBB0002')

    def test_cache_import_does_not_extend_source_age(self):
        self.stabiel()
        with sqlite3.connect(self.db) as c: c.execute("DELETE FROM catalogus_clubs WHERE bronId!='AAA0001'")
        self.pilot.c.execute('INSERT INTO cache VALUES(?,?,?)', ('club:AAA0001',self.now-29*86400,
             json.dumps({'clubs':[], 'teams':[{'seizoen':'2026-2027'}], 'wedstrijden':[]})))
        self.pilot.c.commit()
        self.bezoek('club:AAA0001', nu=self.now-20, bron='cache')
        self.assertEqual(self.taken(), [])
        self.now += 2*86400
        self.stabiel()
        self.assertIsNone(self.taken()[0]['cacheData'], 'Een recente cache-import maakt oude brondata niet opnieuw vers')

    def test_new_season_never_reuses_previous_season(self):
        self.now = datetime(2027, 7, 1, 14, tzinfo=m.ZONE).timestamp()
        self.stabiel()
        self.pilot.c.execute('INSERT INTO cache VALUES(?,?,?)', ('club:AAA0001', self.now-86400,
             json.dumps({'clubs':[], 'teams':[{'seizoen':'2026-2027'}], 'wedstrijden':[]})))
        self.pilot.c.commit()
        self.assertEqual(self.taken()[0]['seizoen'], '2027-2028')
        self.assertIsNone(self.taken()[0]['cacheData'])


if __name__ == '__main__': unittest.main()
