import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
import json

def module(name):
 s=importlib.util.spec_from_file_location(name,Path(__file__).parents[1]/'scripts'/name)
 m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=module('catalogus-clubs.py')
pilot=module('catalogus-pilot.py')

class ClubHerstel(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.pad=Path(self.tmp.name)/'data.db'
  self.c=sqlite3.connect(self.pad);self.addCleanup(self.c.close)
  self.c.execute("CREATE TABLE catalogus_taken(id TEXT,clubBronId TEXT,teamBronId TEXT,status TEXT,updated TEXT,opnieuwNa TEXT,pogingen INTEGER)")
 def voeg(self,id,status='nieuw',vanaf='',updated=1000,team=''):
  self.c.execute('INSERT INTO catalogus_taken VALUES(?,?,?,?,?,?,?)',(id,id,team,status,m.iso(updated),vanaf,1));self.c.commit()
 def test_clubs_wait_and_are_not_starved_by_old_pool_tasks(self):
  self.voeg('oude-poule',team='123');self.voeg('pauze','fout',m.iso(9000));self.voeg('nieuw',updated=2000)
  jobs=m.taken(self.pad,nu=3000)
  self.assertEqual([j['clubBronId'] for j in jobs],['nieuw'])
  self.assertEqual(len(jobs),1)
  self.c.execute("UPDATE catalogus_taken SET status='klaar' WHERE id='nieuw'");self.c.commit()
  self.assertEqual(m.taken(self.pad,nu=8999),[])
  self.assertEqual(m.taken(self.pad,nu=9000)[0]['clubBronId'],'pauze')
 def test_legacy_failure_and_interrupted_visit_recover(self):
  self.voeg('oud','fout');self.assertEqual(m.taken(self.pad,nu=1299),[])
  self.assertEqual(m.taken(self.pad,nu=1300)[0]['clubBronId'],'oud')
  self.c.execute("UPDATE catalogus_taken SET status='bezig'");self.c.commit()
  self.assertEqual(m.taken(self.pad,nu=1599),[])
  self.assertEqual(m.taken(self.pad,nu=1601)[0]['clubBronId'],'oud')
 def test_backoff_respects_retry_after_and_global_pause(self):
  self.assertEqual(m.timestamp(m.herpoging(1,'timeout',nu=1000)),1300)
  self.assertEqual(m.timestamp(m.herpoging(2,'timeout',nu=1000)),1900)
  self.assertEqual(m.timestamp(m.herpoging(1,'Bron HTTP 429',nu=1000)),22600)
  self.assertEqual(m.timestamp(m.herpoging(1,'Bron HTTP 403',nu=1000)),4600)
  self.assertEqual(m.timestamp(m.herpoging(1,'Bron HTTP 429; bronWachtTot=99000',nu=1000)),99000)
  self.assertEqual(m.timestamp(m.herpoging(99,'timeout',bron_vanaf=50000,nu=1000)),50000)
 def test_shared_budget_gap_and_sanitized_status(self):
  p=pilot.Pilot(Path(self.tmp.name)/'pilot.db','test');self.addCleanup(p.c.close)
  p.c.execute("INSERT INTO grenzen VALUES('pauzeTot',9000)");p.c.commit()
  self.assertFalse(p.mag_ophalen(8999));self.assertTrue(p.mag_ophalen(9000))
  f=Path(self.tmp.name)/'status.json';m.publiceer(f,p.volgende_poging(3000),nu=3000)
  self.assertEqual(json.loads(f.read_text()),{'bijgewerkt':m.iso(3000),'bronOpnieuwNa':m.iso(9000)})
  self.assertEqual(f.stat().st_mode & 0o777,0o600)
  self.assertTrue(m.beschikbaar(self.pad))
  p.wacht_club('club:FICTIEF',15000)
  other=pilot.Pilot(Path(self.tmp.name)/'pilot.db','productie');self.addCleanup(other.c.close)
  self.assertEqual(other.club_vanaf('club:FICTIEF'),15000)
  other.wacht_club('club:FICTIEF',12000)
  self.assertEqual(p.club_vanaf('club:FICTIEF'),15000,'Andere omgeving mag de clubpauze niet verkorten')


# Uitvoer van de echte worker, met uitsluitend tijdelijke databases en nagebootste Docker/bronantwoorden.
class WorkerHerstel(unittest.TestCase):
 def test_429_wait_retry_success_without_second_user_request(self):
  import shutil,subprocess,runpy,sys,io,contextlib
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'scripts').mkdir();(root/'pb_test_data').mkdir()
   basis=root/'planning_documenten'/'test';basis.mkdir(parents=True);(basis/'catalogus-pilot.actief').touch()
   for naam in ['catalogus-worker.py','catalogus-clubs.py','catalogus-pilot.py','catalogus-meldingen.py']:
    shutil.copy(Path(__file__).parents[1]/'scripts'/naam,root/'scripts'/naam)
   db=root/'pb_test_data'/'data.db'
   with sqlite3.connect(db) as c:
    c.executescript('''CREATE TABLE catalogus_taken(id TEXT,sleutel TEXT,clubBronId TEXT,teamBronId TEXT,pouleId TEXT,status TEXT,fout TEXT,created TEXT,updated TEXT,opnieuwNa TEXT,pogingen INTEGER);
    CREATE TABLE teams(officieelTeam TEXT);
    CREATE TABLE catalogus_teams(id TEXT,bronId TEXT,clubBronId TEXT,seizoen TEXT,pouleId TEXT,spelvorm TEXT);
    CREATE TABLE catalogus_wedstrijden(bronId TEXT);
    INSERT INTO catalogus_taken VALUES('club','club:FICTIEF','FICTIEF','','','nieuw','','','1970-01-01T00:00:00Z','',0);
    INSERT INTO catalogus_taken VALUES('pool','team:123','CLUB000','123','','nieuw','','','1970-01-01T00:00:00Z','',0);''')
   now=[10000];browser=[];payload=[]
   def fake(cmd,**kw):
    if cmd[1]=='run':
     browser.append(cmd)
     if len(browser)==1:raise subprocess.CalledProcessError(1,cmd,stderr=b'Bron HTTP 429; bronWachtTot=50000')
     output=next(x for x in cmd if x.endswith(':/resultaat')).split(':/resultaat')[0]
     Path(output,'catalogus.json').write_text(json.dumps({'clubs':[],'teams':[],'wedstrijden':[]}))
     return subprocess.CompletedProcess(cmd,0,stdout='',stderr='')
    if cmd[2]=='-i':
     payload[:]=[json.loads(kw['input'])];return subprocess.CompletedProcess(cmd,0,stdout='',stderr='')
    opdracht=cmd[4];uit=''
    with sqlite3.connect(db) as c:
     if opdracht=='catalogus-taken':uit='[]'
     elif opdracht=='catalogus-taakstatus':
      c.execute('UPDATE catalogus_taken SET status=?,updated=?,opnieuwNa=?,pogingen=pogingen+? WHERE id=?',(cmd[6],m.iso(now[0]),cmd[7] if len(cmd)>7 else '',int(cmd[6]=='bezig'),cmd[5]))
     elif opdracht=='catalogus-import':
      c.execute("UPDATE catalogus_taken SET status='klaar',opnieuwNa='',pogingen=0 WHERE id=?",(payload[0]['taakId'],));uit='Catalogus bijgewerkt: fictief'
     else:raise AssertionError(opdracht)
    return subprocess.CompletedProcess(cmd,0,stdout=uit,stderr='')
   def worker():
    with patch.object(sys,'argv',['worker','--omgeving','test']),patch('subprocess.run',fake),patch('time.time',lambda:now[0]),contextlib.redirect_stdout(io.StringIO()):
     result=runpy.run_path(str(root/'scripts'/'catalogus-worker.py'),run_name='__main__')
     result['lock'].close();result['bron_lock'].close();result['pilot'].c.close()
   worker()
   with sqlite3.connect(db) as c:
    status,vanaf=c.execute("SELECT status,opnieuwNa FROM catalogus_taken WHERE id='club'").fetchone()
   self.assertEqual(status,'fout');self.assertEqual(m.timestamp(vanaf),50000)
   now[0]=10060;worker();self.assertEqual(len(browser),1,'Geen bronverzoek tijdens pauze')
   now[0]=50001;worker();self.assertEqual(len(browser),2)
   with sqlite3.connect(db) as c:self.assertEqual(c.execute("SELECT status,pogingen FROM catalogus_taken WHERE id='club'").fetchone(),('klaar',0))

if __name__=='__main__':unittest.main()
