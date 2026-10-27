import importlib.util
from datetime import datetime
from pathlib import Path
import json
import sqlite3
import tempfile
import unittest


def module(naam, bestand):
    spec=importlib.util.spec_from_file_location(naam,Path(__file__).parents[1]/'scripts'/bestand)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

m=module('pilot','catalogus-pilot.py')
n=module('meldingen','catalogus-meldingen.py')


def tijd(dag='2026-10-17', uur='20:00'):
    return datetime.fromisoformat(dag+'T'+uur+':00').replace(tzinfo=m.ZONE).timestamp()


def poule(key='2026-2027:Veld:123', wedstrijd=False):
    return {'sleutel':key,'wedstrijdVandaag':wedstrijd,'seizoen':'2026-2027','teamBronId':'1','pouleId':'123'}


class PilotTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.pad=self.root/'pilot.db'
        self.p=m.Pilot(self.pad,'test');self.addCleanup(self.p.c.close)

    def run_ok(self, taak, nu, bron='browser'):
        ident=self.p.begin(taak,bron,nu)
        self.p.resultaat(ident,taak,data={'clubs':[],'teams':[],'wedstrijden':[],'taakId':'niet-delen'},nu=nu+1)

    def test_daily_0500_and_no_extra_match_or_evening_check(self):
        t=poule();taken=self.p.taken([t],tijd(uur='13:00'))
        self.assertEqual(taken[0]['slot'],'dag:2026-10-17')
        self.run_ok(taken[0],tijd(uur='13:00'))
        self.assertEqual(self.p.taken([t],tijd(uur='14:00')),[])
        self.assertEqual(self.p.taken([t],tijd(uur='19:59')),[])
        self.assertEqual(self.p.taken([t],tijd()),[])
        self.assertEqual(self.p.taken([t],tijd(uur='21:00')),[])
        self.assertEqual(self.p.taken([t],tijd('2026-10-18','00:19')),[])
        self.assertEqual(self.p.taken([t],tijd('2026-10-18','00:20')),[])
        self.assertEqual(self.p.taken([t],tijd('2026-10-18','04:59')),[])
        nacht=self.p.taken([t],tijd('2026-10-18','05:00'))[0]
        self.assertEqual(nacht['slot'],'dag:2026-10-18')
        self.run_ok(nacht,tijd('2026-10-18','05:00'))
        self.assertEqual(self.p.taken([t],tijd('2026-10-18','07:00')),[])
        t['wedstrijdVandaag']=True
        self.assertEqual(self.p.taken([t],tijd('2026-10-18','07:00')),[])

    def test_new_poule_before_0500_counts_for_same_day(self):
        t=poule();job=self.p.taken([t],tijd(uur='00:05'))[0]
        self.run_ok(job,tijd(uur='00:05'))
        self.assertEqual(self.p.taken([t],tijd(uur='00:20')),[])
        self.assertEqual(self.p.taken([t],tijd(uur='05:00')),[])
        self.assertEqual(len(self.p.taken([poule('nieuw')],tijd(uur='14:00'))),1)

    def test_catchup_after_downtime_and_previous_slot_migration(self):
        t=poule();self.run_ok({**t,'slot':'eerste'},tijd(uur='10:00'))
        self.assertEqual(self.p.taken([t],tijd()),[])
        self.assertEqual(len(self.p.taken([t],tijd('2026-10-18','11:00'))),1)

    def test_winter_time_does_not_duplicate_day_check(self):
        t=poule();self.run_ok({**t,'slot':'dag:2026-10-24'},tijd('2026-10-24','05:00'))
        self.assertEqual(self.p.taken([t],tijd('2026-10-25','00:19')),[])
        repeated=datetime.fromisoformat('2026-10-25T02:30:00').replace(tzinfo=m.ZONE)
        for fold in [0,1]:self.assertEqual(self.p.taken([t],repeated.replace(fold=fold).timestamp()),[])
        job=self.p.taken([t],tijd('2026-10-25','05:00'))[0]
        self.run_ok(job,tijd('2026-10-25','05:00'))
        self.assertEqual(self.p.taken([t],tijd('2026-10-25','06:00')),[])

    def test_cache_shared_no_private_task_id_and_no_age_extension(self):
        t={**poule(),'slot':'eerste'};now=tijd()
        self.run_ok(t,now)
        other=m.Pilot(self.pad,'productie');self.addCleanup(other.c.close)
        self.assertNotIn('taakId',other.cache(t,now+100))
        self.run_ok(t,now+300,bron='cache')
        self.assertIsNotNone(other.cache(t,now+7300), 'Dezelfde kalenderdag: geen tweede bronbezoek')
        self.assertIsNone(other.cache(t,tijd('2026-10-18','00:20')))
        self.assertIsNone(other.cache({**t,'sleutel':'2027-2028:Veld:123'},now+100))

    def test_failed_shared_visit_does_not_block_other_poules_or_retry_same_day(self):
        t=self.p.taken([poule()],tijd(uur='00:20'))[0]
        ident=self.p.begin(t,'browser',tijd(uur='00:20'))
        self.p.resultaat(ident,t,fout='Bron HTTP 429',nu=tijd(uur='00:21'))
        other=m.Pilot(self.pad,'productie');self.addCleanup(other.c.close)
        self.assertEqual(other.taken([poule()],tijd(uur='14:00')),[])
        nieuw=poule('nieuwe-poule')
        self.assertEqual(other.taken([poule(),nieuw],tijd(uur='14:00'))[0]['sleutel'],'nieuwe-poule')
        self.assertEqual(other.taken([poule()],tijd('2026-10-18','04:59')),[])
        self.assertTrue(other.taken([poule()],tijd('2026-10-18','05:00')))

    def test_global_gap_budget_and_cooldown(self):
        t={**poule(),'slot':'eerste'};now=tijd()
        self.assertTrue(self.p.mag_ophalen(now))
        ident=self.p.begin(t,'browser',now)
        self.assertFalse(self.p.mag_ophalen(now+4.99))
        self.p.resultaat(ident,t,fout='Bron HTTP 429; bronWachtTot='+str(int(now+50000)),nu=now+1)
        other=m.Pilot(self.pad,'productie');self.addCleanup(other.c.close)
        self.assertFalse(other.mag_ophalen(now+30000))
        self.assertTrue(other.mag_ophalen(now+50001))

    def test_five_seconds_rest_after_completion_shared_between_environments(self):
        t={**poule(),'slot':'eerste'};now=tijd()
        ident=self.p.begin(t,'browser',now)
        self.p.resultaat(ident,t,data={'wedstrijden':[]},nu=now+30)
        other=m.Pilot(self.pad,'productie');self.addCleanup(other.c.close)
        self.assertFalse(other.mag_ophalen(now+34.99))
        self.assertTrue(other.mag_ophalen(now+35))
        # Cache-imports zijn geen bronbezoeken en verlengen de rust niet.
        self.run_ok(t,now+36,bron='cache')
        self.assertTrue(other.mag_ophalen(now+37))

    def test_budget_24_browser_visits_per_local_day(self):
        now=tijd(uur='10:00');t={**poule(),'slot':'eerste'}
        for i in range(24):self.run_ok(t,now+i*120)
        self.assertFalse(self.p.mag_ophalen(now+24*120))
        self.assertTrue(self.p.mag_ophalen(tijd('2026-10-18','10:00')))

    def test_failed_slot_waits_for_next_schedule(self):
        now=tijd();t=self.p.taken([poule()],now)[0]
        ident=self.p.begin(t,'browser',now)
        self.p.resultaat(ident,t,fout='Bron HTTP 401',nu=now+1)
        self.assertEqual(self.p.taken([poule()],tijd(uur='22:00')),[])
        self.assertTrue(self.p.taken([poule()],tijd('2026-10-18')))

    def test_report_requires_real_experience(self):
        t={**poule(),'slot':'eerste'};now=tijd()
        self.assertIn('Geen pilotmetingen',self.p.rapport(now,now+100))
        for i in range(6):self.run_ok(t,now+i,bron='cache')
        self.assertIn('Nog niet uitbreiden',self.p.rapport(now,now+100))
        for i in range(5):self.run_ok(t,now+10+i)
        self.assertIn('kleine uitbreiding',self.p.rapport(now,now+100))
        self.assertIn('Nog niet uitbreiden',self.p.rapport(now,now+100,verwacht=['andere-poule']))
        ident=self.p.begin(t,'browser',now+20);self.p.resultaat(ident,t,fout='Bron HTTP 429',nu=now+21)
        self.assertIn('Nog niet uitbreiden',self.p.rapport(now,now+100))

    def test_registered_only_deduplicated_and_readonly(self):
        bron=self.root/'bron.db'
        with sqlite3.connect(bron) as c:
            c.executescript('''CREATE TABLE teams(officieelTeam TEXT);
            CREATE TABLE catalogus_teams(id TEXT,bronId TEXT,clubBronId TEXT,seizoen TEXT,pouleId TEXT,spelvorm TEXT);
            CREATE TABLE catalogus_taken(id TEXT,sleutel TEXT);
            CREATE TABLE catalogus_wedstrijden(seizoen TEXT,thuisBronId TEXT,uitBronId TEXT,datum TEXT);
            INSERT INTO teams VALUES('a');INSERT INTO teams VALUES('a');INSERT INTO teams VALUES('b');
            INSERT INTO catalogus_teams VALUES('a','1','ABC1234','2026-2027','123','Veld');
            INSERT INTO catalogus_teams VALUES('b','2','ABC1234','2026-2027','123','Veld');
            INSERT INTO catalogus_teams VALUES('c','3','ABC1234','2026-2027','999','Veld');
            INSERT INTO catalogus_wedstrijden VALUES('2026-2027','2','3','2026-10-17');''')
        vooraf=bron.read_bytes();rows=m.geregistreerd(bron)
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['pouleId'],'123')
        self.assertEqual(vooraf,bron.read_bytes())

    def test_one_evaluation_mail_at_due_date_with_copyable_metrics(self):
        basis=self.root/'productie';basis.mkdir()
        conf={'id':'week','vanaf':'2026-10-17T13:00:00+02:00','op':'2026-10-24T20:00:00+02:00'}
        (basis/'catalogus-evaluatie.json').write_text(json.dumps(conf))
        meld=n.Meldingen(basis/'mails.db','productie');self.addCleanup(meld.c.close)
        due=datetime.fromisoformat(conf['op']).timestamp()
        m.plan_evaluatie(meld,basis,self.pad,nu=due-1)
        self.assertEqual(meld.c.execute('SELECT count(*) FROM mails').fetchone()[0],0)
        m.plan_evaluatie(meld,basis,self.pad,nu=due)
        m.plan_evaluatie(meld,basis,self.pad,nu=due+100)
        mails=meld.c.execute('SELECT html FROM mails').fetchall();self.assertEqual(len(mails),1)
        self.assertIn('Geen pilotmetingen',mails[0][0])
        prompt=mails[0][0].split('<pre style="white-space:pre-wrap">')[1]
        self.assertIn('Meetperiode:',prompt);self.assertIn('Geen pilotmetingen',prompt)
        self.assertIn('geen SCHC-site zonder mijn expliciete toestemming',prompt)


if __name__=='__main__':unittest.main()
