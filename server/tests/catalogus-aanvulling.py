import importlib.util
from pathlib import Path
from contextlib import closing
from datetime import datetime
import json
import sqlite3
import tempfile
import unittest
from zoneinfo import ZoneInfo


def module(naam):
    s=importlib.util.spec_from_file_location(naam,Path(__file__).parents[1]/'scripts'/naam)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m


m=module('catalogus-aanvulling.py');p=module('catalogus-pilot.py');n=module('catalogus-meldingen.py')


class AanvullingTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.nu=datetime(2026,11,1,12,tzinfo=ZoneInfo('Europe/Amsterdam')).timestamp()
        self.bron=self.root/'data.db'
        with closing(sqlite3.connect(self.bron)) as c:
            c.executescript("CREATE TABLE catalogus_clubs(bronId TEXT); CREATE TABLE catalogus_teams(seizoen TEXT); INSERT INTO catalogus_clubs VALUES('AAA0001'),('BBB0002'),('CCC0003');")
        self.p=p.Pilot(self.root/'pilot.db','productie',dagbudget=288);self.addCleanup(self.p.c.close)
        self.a=m.Aanvulling(self.root/'aanvulling.db','productie',{'id':'ronde','seizoen':'2026-2027'});self.addCleanup(self.a.c.close)
        self.lijst={'clubs':[{'bronId':id,'naam':id} for id in ['AAA0001','BBB0002','CCC0003']], 'teams':[], 'wedstrijden':[]}

    def lijst_klaar(self):
        taak=self.a.taken(self.p,self.nu)[0]
        self.a.valideer(taak,self.lijst,self.bron)
        self.a.resultaat(taak,self.lijst,nu=self.nu)

    def data(self,id):return {'clubs':[{'bronId':id}], 'teams':[{'bronId':'123','clubBronId':id,'seizoen':'2026-2027'}], 'wedstrijden':[]}

    def test_config_explicit_and_requires_light_route(self):
        self.assertIsNone(m.configuratie(self.root))
        cfg=self.root/'catalogus-aanvulling.json';cfg.write_text(json.dumps({'id':'ronde','seizoen':'2026-2027'}))
        with self.assertRaisesRegex(ValueError,'lichte'):m.configuratie(self.root)
        for marker in ['catalogus-pilot.actief','catalogus-browser-sessie.actief','catalogus-clubs-licht.actief']:(self.root/marker).touch()
        self.assertEqual(m.configuratie(self.root),{'id':'ronde','seizoen':'2026-2027'})

    def test_five_minute_gap_shared_source_and_persistent_resume(self):
        self.lijst_klaar();t=self.a.taken(self.p,self.nu)[0]
        self.assertEqual(t['clubBronId'],'AAA0001')
        ident=self.p.begin(t,'browser',self.nu)
        self.p.resultaat(ident,t,data=self.data('AAA0001'),nu=self.nu+1)
        self.a.resultaat(t,self.data('AAA0001'),nu=self.nu+1)
        self.assertEqual(self.a.taken(self.p,self.nu+299),[])
        self.assertEqual(self.a.taken(self.p,self.nu+300)[0]['clubBronId'],'BBB0002')
        other=m.Aanvulling(self.root/'aanvulling.db','productie',{'id':'ronde','seizoen':'2026-2027'});self.addCleanup(other.c.close)
        self.assertEqual(other.taken(self.p,self.nu+300)[0]['clubBronId'],'BBB0002')
        test=p.Pilot(self.root/'pilot.db','test');self.addCleanup(test.c.close)
        test.begin({'sleutel':'poule:ander','slot':'dag'},'browser',self.nu+250)
        self.assertEqual(other.taken(self.p,self.nu+300),[],'Andere bronbezoeken schuiven de aanvulling op')

    def test_complete_cache_without_source_and_season_protection(self):
        self.lijst_klaar()
        t={'sleutel':'club:BBB0002','slot':'expliciet'}
        ident=self.p.begin(t,'browser',self.nu)
        self.p.resultaat(ident,t,data=self.data('BBB0002'),nu=self.nu+1)
        taak=self.a.taken(self.p,self.nu+2)[0]
        self.assertEqual(taak['clubBronId'],'BBB0002');self.assertIsNotNone(taak['cacheData'])
        self.a.resultaat(taak,taak['cacheData'],nu=self.nu+2)
        self.assertEqual(self.a.taken(self.p,self.nu+3),[])
        self.assertEqual(self.a.taken(self.p,self.nu+301)[0]['clubBronId'],'AAA0001')

    def test_failure_keeps_pending_and_obeys_source_pause(self):
        self.lijst_klaar();t=self.a.taken(self.p,self.nu)[0]
        ident=self.p.begin(t,'browser',self.nu)
        self.p.resultaat(ident,t,fout='Bron HTTP 429; bronWachtTot='+str(int(self.nu+50000)),nu=self.nu+1)
        self.a.resultaat(t,fout='Bron HTTP 429',bron_vanaf=self.p.volgende_poging(self.nu+1),nu=self.nu+1)
        self.assertFalse(self.p.mag_ophalen(self.nu+49999))
        self.assertNotEqual(self.a.taken(self.p,self.nu+400)[0]['clubBronId'],'AAA0001')
        self.assertTrue(self.a.actief)
        row=self.a.c.execute("SELECT status,vanaf FROM clubs WHERE bronId='AAA0001'").fetchone()
        self.assertEqual(row['status'],'fout');self.assertGreaterEqual(row['vanaf'],self.nu+50000)

    def test_validation_and_no_app_database_writes(self):
        voor=self.bron.read_bytes();t=self.a.taken(self.p,self.nu)[0]
        for data in [{**self.lijst,'clubs':[]},{**self.lijst,'clubs':self.lijst['clubs'][:1]}]:
            with self.assertRaises(ValueError):self.a.valideer(t,data,self.bron)
        self.lijst_klaar();t=self.a.taken(self.p,self.nu)[0]
        with self.assertRaises(ValueError):self.a.valideer(t,self.data('BBB0002'),self.bron)
        data=self.data('AAA0001');data['wedstrijden']=[{'id':'verboden'}]
        with self.assertRaises(ValueError):self.a.valideer(t,data,self.bron)
        self.assertEqual(voor,self.bron.read_bytes())

    def test_stops_when_done_and_one_completion_mail(self):
        self.lijst_klaar()
        for id in ['AAA0001','BBB0002','CCC0003']:
            self.a.resultaat(self.a._taak(id),self.data(id),nu=self.nu)
        self.assertFalse(self.a.actief)
        self.assertEqual(self.a.taken(self.p,self.nu+60*86400),[])
        f=self.root/'status.json';self.a.publiceer(f)
        self.assertEqual(json.loads(f.read_text())['klaar'],3)
        self.assertEqual(f.stat().st_mode&0o777,0o600)
        mails=n.Meldingen(self.root/'mail.db','test');self.addCleanup(mails.c.close)
        self.a.meld_gereed(mails,self.bron);self.a.meld_gereed(mails,self.bron)
        rows=mails.c.execute('SELECT html FROM mails').fetchall()
        self.assertEqual(len(rows),1);self.assertIn('3 clubteamlijsten',rows[0][0])


class WorkerAanvulling(unittest.TestCase):
    def test_real_worker_extended_budget_pause_and_resume(self):
        import shutil,subprocess,runpy,sys,io,contextlib
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'scripts').mkdir();(root/'pb_data').mkdir()
            base=root/'planning_documenten'/'productie';base.mkdir(parents=True)
            for marker in ['catalogus-pilot.actief','catalogus-browser-sessie.actief','catalogus-clubs-licht.actief']:(base/marker).touch()
            (base/'catalogus-aanvulling.json').write_text(json.dumps({'id':'ronde','seizoen':'2026-2027'}))
            for naam in ['catalogus-worker.py','catalogus-clubs.py','catalogus-pilot.py','catalogus-meldingen.py','catalogus-bron.py','catalogus-aanvulling.py']:
                shutil.copy(Path(__file__).parents[1]/'scripts'/naam,root/'scripts'/naam)
            db=root/'pb_data'/'data.db'
            with closing(sqlite3.connect(db)) as c:
                c.executescript('''CREATE TABLE catalogus_taken(id TEXT,sleutel TEXT,clubBronId TEXT,teamBronId TEXT,pouleId TEXT,status TEXT,updated TEXT,opnieuwNa TEXT,pogingen INTEGER);
                  CREATE TABLE teams(officieelTeam TEXT); CREATE TABLE catalogus_clubs(bronId TEXT PRIMARY KEY);
                  CREATE TABLE catalogus_teams(id TEXT,bronId TEXT,clubBronId TEXT,seizoen TEXT,pouleId TEXT,spelvorm TEXT);
                  CREATE TABLE catalogus_wedstrijden(bronId TEXT); CREATE TABLE eigen_spelers(naam TEXT);
                  INSERT INTO eigen_spelers VALUES('Behouden');''')
            now=[datetime(2026,11,1,12,tzinfo=ZoneInfo('Europe/Amsterdam')).timestamp()];bezoeken=[];payload=[]
            pilot=p.Pilot(root/'planning_documenten'/'catalogus-pilot.db','productie')
            for i in range(24):
                t={'sleutel':'vooraf','slot':'dag'};ident=pilot.begin(t,'browser',now[0]-7200+i*10)
                pilot.resultaat(ident,t,data={'clubs':[],'teams':[],'wedstrijden':[]},nu=now[0]-7199+i*10)
            pilot.c.close()
            def fake(cmd,**kw):
                if cmd[1]=='run':
                    bezoeken.append(cmd[-4]);out=Path(next(s for s in cmd if s.endswith(':/resultaat')).split(':/resultaat')[0])
                    (out/'bronmeting.json').write_text(json.dumps({'werkwijze':'licht','bronverzoeken':2}))
                    if len(bezoeken)==2:raise subprocess.CalledProcessError(1,cmd,stderr=b'Bron HTTP 429')
                    clubs=[{'bronId':id,'naam':id} for id in ['AAA0001','BBB0002']]
                    if cmd[-4]:clubs=[c for c in clubs if c['bronId']==cmd[-4]]
                    (out/'catalogus.json').write_text(json.dumps({'clubs':clubs,'teams':[],'wedstrijden':[]}))
                    return subprocess.CompletedProcess(cmd,0,stdout='')
                if cmd[2]=='-i':payload[:]=[json.loads(kw['input'])];return subprocess.CompletedProcess(cmd,0,stdout='')
                if cmd[4]=='catalogus-taken':return subprocess.CompletedProcess(cmd,0,stdout='[]')
                if cmd[4]=='catalogus-import':
                    with closing(sqlite3.connect(db)) as c:
                        with c:
                            for club in payload[0]['clubs']:c.execute('INSERT OR IGNORE INTO catalogus_clubs VALUES(?)',(club['bronId'],))
                    return subprocess.CompletedProcess(cmd,0,stdout='Catalogus bijgewerkt: fixture')
                raise AssertionError(cmd)
            def worker():
                with patch.object(sys,'argv',['worker','--omgeving','productie']),patch('subprocess.run',fake),patch('time.time',lambda:now[0]),contextlib.redirect_stdout(io.StringIO()):
                    d=runpy.run_path(str(root/'scripts'/'catalogus-worker.py'),run_name='__main__')
                    d['lock'].close();d['bron_lock'].close();d['pilot'].c.close();d['aanvulling'].c.close()
            worker();self.assertEqual(bezoeken,[''],'De aangevraagde ronde loopt ook na het oude eigen budget van 24')
            now[0]+=299;worker();self.assertEqual(len(bezoeken),1)
            now[0]+=1;worker();self.assertEqual(bezoeken,['','AAA0001'])
            now[0]+=300;worker();self.assertEqual(len(bezoeken),2,'Geen bronverzoek tijdens 429-pauze')
            now[0]+=21600;worker();self.assertEqual(bezoeken[-1],'BBB0002')
            now[0]+=300;worker();self.assertEqual(bezoeken[-1],'AAA0001')
            now[0]+=300;worker();self.assertEqual(len(bezoeken),4,'Na voltooiing geen nieuwe ronde')
            with closing(sqlite3.connect(db)) as c:self.assertEqual(c.execute('SELECT naam FROM eigen_spelers').fetchall(),[('Behouden',)])


if __name__=='__main__':unittest.main()
