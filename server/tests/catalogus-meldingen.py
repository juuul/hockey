import copy
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('meldingen', Path(__file__).parents[1] / 'scripts' / 'catalogus-meldingen.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def team():
    return {'bronId': '123', 'seizoen': '2026-2027', 'naam': 'Voorbeeld MO11-1', 'wedstrijden': [
        {'bronId': '456', 'datum': '2026-10-31', 'spelen': '', 'thuisNaam': 'Voorbeeld MO11-1',
         'uitNaam': 'Ander MO11-2', 'locatie': '', 'status': ''}]}


class MeldingenTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.pad = Path(self.tmp.name) / 'mail.db'
        self.n = m.Meldingen(self.pad, 'test')
        self.addCleanup(self.n.c.close)

    def scan(self, t):
        self.n.controleer([t], '2026-10-17')

    def mails(self):
        return self.n.c.execute('SELECT onderwerp,html FROM mails').fetchall()

    def test_baseline_and_no_unchanged_mail(self):
        self.scan(team()); self.scan(team())
        self.assertEqual(self.mails(), [])
        self.assertEqual(self.pad.stat().st_mode & 0o777, 0o600)

    def test_all_relevant_fields(self):
        for veld in m.VELDEN:
            with self.subTest(veld=veld):
                t = team(); self.scan(t)
                nieuw = copy.deepcopy(t)
                nieuw['wedstrijden'][0][veld] = '2026-11-07' if veld == 'datum' else 'Wijziging <test>'
                aantal = len(self.mails()); self.scan(nieuw); self.scan(nieuw)
                self.assertEqual(len(self.mails()), aantal + 1)
                self.assertIn('Kopieer deze opdracht', self.mails()[-1][1])
                self.assertNotIn('Wijziging <test>', self.mails()[-1][1])

    def test_new_and_historical_matches(self):
        t = team(); self.scan(t)
        nieuw = {**t['wedstrijden'][0], 'bronId': '789', 'spelen': '10:30'}
        t['wedstrijden'].append(nieuw); self.scan(t)
        self.assertEqual(len(self.mails()), 1)
        self.assertIn('Nieuw:', self.mails()[0][1])
        nieuw['datum'] = '2026-09-01'; self.scan(t)
        # Verplaatsing van een toekomstige wedstrijd naar het verleden wordt nog gemeld.
        self.assertEqual(len(self.mails()), 2)
        nieuw['spelen'] = '11:30'; self.scan(t)
        self.assertEqual(len(self.mails()), 2)

    def test_durable_snapshot_and_pending_mail(self):
        self.scan(team())
        n2 = m.Meldingen(self.pad, 'test'); self.addCleanup(n2.c.close)
        t = team(); t['wedstrijden'][0]['spelen'] = '10:30'
        n2.controleer([t], '2026-10-17')
        n2.controleer([t], '2026-10-17')
        self.assertEqual(len(self.mails()), 1)

    def test_one_mail_per_outage_and_safe_reason(self):
        taak = {'clubBronId': 'ABC1234', 'teamBronId': '123', 'seizoen': '2026-2027'}
        self.n.bronresultaat(taak, 'Bron HTTP 401 secret-token')
        self.n.bronresultaat(taak, 'Bron HTTP 429 secret-token')
        self.assertEqual(len(self.mails()), 1)
        self.assertIn('HTTP 401', self.mails()[0][1])
        self.assertNotIn('secret-token', self.mails()[0][1])
        self.n.bronresultaat(taak)
        self.n.bronresultaat(taak, 'Bron HTTP 429')
        self.assertEqual(len(self.mails()), 2)

    def test_club_list_failure(self):
        self.n.bronresultaat({'clubBronId': '', 'teamBronId': ''}, 'timeout')
        self.assertEqual(len(self.mails()), 1)

    def test_retry_hourly_and_success_not_repeated(self):
        self.n.bronresultaat({'clubBronId': 'ABC1234'}, 'timeout')
        calls = []
        def fail(*args):
            calls.append(args)
            raise OSError('SMTP tijdelijk onbereikbaar')
        self.n.verzend(fail, nu=10000)
        self.n.verzend(fail, nu=10060)
        self.assertEqual(len(calls), 1)
        self.n.verzend(lambda *a: calls.append(a), nu=13600)
        self.n.verzend(lambda *a: calls.append(a), nu=17200)
        self.assertEqual(len(calls), 2)

    def test_environment_and_private_tasks_are_not_changed(self):
        self.scan(team()); t = team(); t['wedstrijden'][0]['spelen'] = '09:00'; self.scan(t)
        inhoud = self.mails()[0][1]
        for tekst in ['omgeving test', 'fruit', 'rijbeurten', 'toestemming', 'eigen afwijkingen']:
            self.assertIn(tekst, inhoud)
        prompt = inhoud.split('<pre style="white-space:pre-wrap">', 1)[1]
        self.assertIn('09:00', prompt)
        self.assertIn('Melding van', prompt)

    def test_readonly_source_and_only_linked_teams(self):
        bron = Path(self.tmp.name) / 'bron.db'
        with sqlite3.connect(bron) as c:
            c.executescript('''CREATE TABLE teams(officieelTeam TEXT);
                CREATE TABLE catalogus_teams(id TEXT,bronId TEXT,seizoen TEXT,naam TEXT);
                CREATE TABLE catalogus_wedstrijden(bronId TEXT,datum TEXT,spelen TEXT,thuisNaam TEXT,
                    uitNaam TEXT,locatie TEXT,status TEXT,seizoen TEXT,thuisBronId TEXT,uitBronId TEXT);
                INSERT INTO teams VALUES('a'); INSERT INTO teams VALUES('a');
                INSERT INTO catalogus_teams VALUES('a','123','2026-2027','Voorbeeld');
                INSERT INTO catalogus_teams VALUES('b','999','2026-2027','Ongekoppeld');
                CREATE TABLE catalogus_taken(clubBronId TEXT,teamBronId TEXT,sleutel TEXT,status TEXT);
                INSERT INTO catalogus_taken VALUES('ABC1234','123','team:123:2026-2027','fout');
                INSERT INTO catalogus_taken VALUES('ABC1234','999','team:999:2026-2027','fout');
            ''')
        vooraf = bron.read_bytes()
        self.assertEqual(len(m.lees_catalogus(bron)), 1)
        fouten = m.lees_bronstatus(bron)
        self.assertEqual(len(fouten), 1)
        self.assertEqual(fouten[0]['teamBronId'], '123')
        self.assertEqual(vooraf, bron.read_bytes())


if __name__ == '__main__':
    unittest.main()
