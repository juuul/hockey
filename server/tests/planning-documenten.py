import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('planning',Path(__file__).parents[1]/'scripts'/'planning-documenten.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PlanningTest(unittest.TestCase):
 def test_versions_and_retry(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);c=m.database(root/'test.db')
   old=b'%PDF-old';new=b'%PDF-new'
   registry={'documenten':[{'id':'voorbeeld','naam':'Voorbeeld','seizoen':'2026-2027','url':'https://media.static-hw.nl/media/voorbeeld.pdf','basisSha256':hashlib.sha256(old).hexdigest()}]}
   m.controleer(c,registry,root,lambda u:old)
   self.assertEqual(c.execute('select count(*) from meldingen').fetchone()[0],0)
   m.controleer(c,registry,root,lambda u:new);m.controleer(c,registry,root,lambda u:new)
   self.assertEqual(c.execute('select count(*) from meldingen').fetchone()[0],1)
   self.assertEqual(c.execute('select geaccepteerd from documenten').fetchone()[0],hashlib.sha256(old).hexdigest())
   self.assertEqual(c.execute('select count(*) from versies').fetchone()[0],2)
   def fail(*args):raise OSError('fixture')
   m.verzend(c,fail);self.assertEqual(c.execute('select count(*) from meldingen where verzonden is null').fetchone()[0],1)
   sent=[];m.verzend(c,lambda *a:sent.append(a));m.verzend(c,lambda *a:sent.append(a));self.assertEqual(len(sent),1)
   m.controleer(c,registry,root,fail);m.controleer(c,registry,root,fail)
   self.assertEqual(c.execute('select count(*) from meldingen').fetchone()[0],1)
   self.assertEqual(c.execute('select laatste from documenten').fetchone()[0],hashlib.sha256(new).hexdigest())
 def test_failures_do_not_mail(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);c=m.database(root/'test.db')
   def fail(*args,**kwargs):raise OSError('fixture')
   m.controleer(c,{'documenten':[],'publicatiePagina':'https://www.knhb.nl/competitie/speeldagenkalender'},root,fail)
   self.assertEqual(c.execute('select count(*) from meldingen').fetchone()[0],0)
   self.assertEqual(c.execute('select fout from controles').fetchone()[0],'OSError')
   m.melding(c,'fout:oude-mail','Oude storingsmail','fixture');sent=[]
   m.verzend(c,lambda *args:sent.append(args));self.assertEqual(sent,[])
 def test_calendar_validation(self):
  calendar={'bronId':'fixture','bron':'https://media.static-hw.nl/media/fixture.pdf','seizoen':'2026-2027','spelvorm':'Veld','dagen':[{'datum':'2026-10-31','status':'speeldag'}]}
  m.valideer_kalenders([calendar],calendar['bron'],calendar['seizoen'])
  for change in [{'bron':'https://example.com/other.pdf'},{'dagen':[{'datum':'2026-02-30','status':'speeldag'}]},{'dagen':[{'datum':'2026-10-31','status':'onbekend'}]}]:
   with self.assertRaises(ValueError):m.valideer_kalenders([{**calendar,**change}],calendar['bron'],calendar['seizoen'])
  with self.assertRaises(ValueError):m.valideer_kalenders([calendar,calendar],calendar['bron'],calendar['seizoen'])
 def test_links(self):
  a=b'<a href="https://media.static-hw.nl//media/calendar.pdf">PDF</a><a href="https://media.static-hw.nl/media/calendar.pdf">PDF</a>'
  self.assertEqual(m.links(a),['https://media.static-hw.nl/media/calendar.pdf'])
  for url in ['http://media.static-hw.nl/x.pdf','https://example.com/x.pdf','https://media.static-hw.nl:444/x.pdf']:
   with self.assertRaises(ValueError):m.url_ok(url)
if __name__=='__main__':unittest.main()
