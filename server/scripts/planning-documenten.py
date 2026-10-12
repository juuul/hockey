#!/usr/bin/env python3
"""Controleer openbare bronbestanden; wijzigingen wachten altijd op menselijke beoordeling."""
import argparse
from datetime import datetime
import fcntl
import hashlib
import html
import json
from pathlib import Path
import re
import sqlite3
import subprocess
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
MAX_SIZE = 30 * 1024 * 1024
HOSTS = {'www.knhb.nl', 'knhb.nl', 'preview.hockey.nl', 'media.static-hw.nl'}

def nu():
    return datetime.now(ZoneInfo('Europe/Amsterdam')).isoformat(timespec='seconds')

def url_ok(url):
    p = urlsplit(url)
    if p.scheme != 'https' or p.hostname not in HOSTS or p.username or p.password or p.port not in (None, 443):
        raise ValueError('Bronlink buiten de toegestane openbare bronhosts')
    return url

class BronRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        url_ok(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def download(url, pdf=True):
    url_ok(url)
    with build_opener(BronRedirect()).open(Request(url, headers={'User-Agent': 'HockeyWisselapp planningcontrole/1.0'}), timeout=30) as response:
        url_ok(response.geturl())
        data = response.read(MAX_SIZE + 1)
    if len(data) > MAX_SIZE or (pdf and not data.startswith(b'%PDF-')):
        raise ValueError('Geen bruikbare PDF of bestand te groot')
    return data

def links(data):
    tekst = html.unescape(data.decode('utf-8')).replace('\\/', '/')
    urls = re.findall(r'https://media\.static-hw\.nl/[^\s"<>]+?\.pdf', tekst, flags=re.I)
    return sorted(set(urlunsplit((urlsplit(u).scheme, urlsplit(u).netloc, re.sub('/+', '/', urlsplit(u).path), '', '')) for u in urls))

def database(pad):
    c = sqlite3.connect(pad)
    c.execute('pragma journal_mode=WAL')
    c.executescript('''
    create table if not exists documenten(id text primary key, naam text, seizoen text, url text, geaccepteerd text, laatste text, gecontroleerd text, fout text);
    create table if not exists versies(document text, sha text, gevonden text, pad text, status text, primary key(document,sha));
    create table if not exists controles(sleutel text primary key, gecontroleerd text, fout text);
    create table if not exists meldingen(sleutel text primary key, onderwerp text, html text, verzonden text, fout text);
    ''')
    return c

def melding(c, sleutel, onderwerp, inhoud):
    c.execute('insert or ignore into meldingen values(?,?,?,null,null)', (sleutel, onderwerp, inhoud))

def controleer(c, register, basis, ophalen=download):
    for d in register['documenten']:
        url_ok(d['url'])
        if not re.fullmatch(r'[a-z0-9-]+', d['id']):
            raise ValueError('Ongeldige documentidentiteit')
        c.execute('insert or ignore into documenten values(?,?,?,?,?,null,null,null)', (d['id'],d['naam'],d['seizoen'],d['url'],d.get('basisSha256')))
        c.execute('update documenten set naam=?,seizoen=?,url=? where id=?', (d['naam'],d['seizoen'],d['url'],d['id']))
        origineel = basis / 'bestanden' / d['id'] / (str(d.get('basisSha256'))+'.pdf')
        if origineel.exists() and hashlib.sha256(origineel.read_bytes()).hexdigest() == d.get('basisSha256'):
            c.execute('insert or ignore into versies values(?,?,?,?,?)',(d['id'],d['basisSha256'],nu(),str(origineel),'actief'))
        try:
            data = ophalen(d['url'])
            sha = hashlib.sha256(data).hexdigest()
            mapje = basis / 'bestanden' / d['id']; mapje.mkdir(parents=True,exist_ok=True)
            pad = mapje / (sha+'.pdf')
            if not pad.exists():
                tijdelijk = pad.with_suffix('.tmp'); tijdelijk.write_bytes(data); tijdelijk.replace(pad)
            geaccepteerd = c.execute('select geaccepteerd from documenten where id=?',(d['id'],)).fetchone()[0]
            status = 'actief' if sha == geaccepteerd else 'beoordelen'
            c.execute('insert or ignore into versies values(?,?,?,?,?)', (d['id'],sha,nu(),str(pad),status))
            c.execute('update documenten set laatste=?,gecontroleerd=?,fout=null where id=?',(sha,nu(),d['id']))
            if status == 'beoordelen':
                melding(c, d['id']+':'+sha, 'Nieuwe planningsdocumentversie gevonden: '+d['naam'],
                    '<p>Een planningsbestand is gewijzigd. De bestaande planning is nog actief. Of datums inhoudelijk veranderd zijn, moet nog worden beoordeeld.</p>'
                    +'<p>'+html.escape(d['naam'])+' · '+html.escape(d['seizoen'])+'</p><p><a href="'+html.escape(d['url'],quote=True)+'">Open brondocument</a></p>'
                    +'<p>Vraag in de GPT-app: “Bekijk de nieuwe planningversie '+html.escape(d['id'])+' met SHA256 '+sha+', vergelijk met de vorige versie en zet de wijzigingen klaar.”</p>'
                    +'<p>De PDF is op de server bewaard. Pas na jouw goedkeuring worden de centrale planning en teams bijgewerkt.</p>')
        except (OSError, ValueError) as exc:
            c.execute('update documenten set gecontroleerd=?,fout=? where id=?',(nu(),type(exc).__name__,d['id']))
        c.commit()
    # Nieuwe/verwijderde PDF-links op de publicatiepagina ook melden: een vervangende URL
    # mag niet onopgemerkt blijven doordat het oude bestand nog steeds bereikbaar is.
    if register.get('publicatiePagina'):
        try:
            gevonden = links(ophalen(register['publicatiePagina'], pdf=False))
            if not gevonden:
                raise ValueError('Geen documentlinks in publicatiepagina')
            c.execute('insert or replace into controles values(?,?,null)',('publicatie',nu()))
            bekend = set(d['url'] for d in register['documenten'])
            extra = sorted(set(gevonden)-bekend); weg = sorted(bekend-set(gevonden))
            if extra or weg:
                sha = hashlib.sha256(json.dumps([extra,weg]).encode()).hexdigest()
                melding(c,'publicatie:'+sha,'Planningpublicatie: nieuwe of verwijderde documentlinks','<p>De publicatiepagina bevat nieuwe of verdwenen PDF-links. Laat deze in de GPT-app beoordelen en werk zo nodig het documentregister bij.</p><p>Nieuw:</p>'+''.join('<p>'+html.escape(u)+'</p>' for u in extra)+'<p>Verdwenen:</p>'+''.join('<p>'+html.escape(u)+'</p>' for u in weg))
        except (OSError, ValueError) as exc:
            c.execute('insert or replace into controles values(?,?,?)',('publicatie',nu(),type(exc).__name__))
        c.commit()

def stuur_mail(omgeving, ontvanger, onderwerp, inhoud):
    container = 'hockey-pocketbase-test' if omgeving == 'test' else 'hockey-pocketbase'
    payload = json.dumps({'aan':[ontvanger],'onderwerp':onderwerp,'html':inhoud}).encode()
    hook = (ROOT / 'scripts' / 'planning-mail.pb.js').read_bytes()
    # Native PocketBase leest productieversleuteling zelf; geen sleutel/env uitlezen.
    subprocess.run(['docker','exec','-i',container,'sh','-c','mkdir -p /tmp/planning-mail-hooks && cat > /tmp/planning-mail-hooks/mail.pb.js'],input=hook,check=True,capture_output=True)
    subprocess.run(['docker','exec','-i',container,'sh','-c','cat > /tmp/planning-mail.json'],input=payload,check=True,capture_output=True)
    args = ['docker','exec',container,'/pb/pocketbase','planning-mail','/tmp/planning-mail.json','--hooksDir=/tmp/planning-mail-hooks']
    if omgeving == 'productie': args.append('--encryptionEnv=PB_ENCRYPTION_KEY')
    r = subprocess.run(args,check=True,capture_output=True,text=True,timeout=60)
    if 'PLANNING_MAIL_OK' not in r.stdout: raise ValueError('Mailverzending niet bevestigd')

def verzend(c, verstuur):
    # Oude wachtende storingsmails worden niet meer verzonden.
    for sleutel, onderwerp, inhoud in c.execute("select sleutel,onderwerp,html from meldingen where verzonden is null and sleutel not like 'fout:%'").fetchall():
        try:
            verstuur(onderwerp,inhoud)
            c.execute('update meldingen set verzonden=?,fout=null where sleutel=?',(nu(),sleutel))
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            c.execute('update meldingen set fout=? where sleutel=?',(type(exc).__name__,sleutel))
        c.commit()

def status(c,basis):
    c.row_factory = sqlite3.Row
    docs=[dict(r) for r in c.execute('select id,naam,seizoen,url,geaccepteerd,laatste,gecontroleerd,fout from documenten order by id')]
    for d in docs:
        d['versies']=[dict(r) for r in c.execute('select sha,gevonden,status from versies where document=? order by gevonden desc',(d['id'],))]
    publicatie=c.execute("select fout from controles where sleutel='publicatie'").fetchone()
    rapport={'publicatieFout':publicatie[0] if publicatie else None,'bijgewerkt':nu(),'documenten':docs,'wachtendeMails':c.execute("select count(*) from meldingen where verzonden is null and sleutel not like 'fout:%'").fetchone()[0]}
    p=basis/'status.json'; t=p.with_suffix('.tmp');t.write_text(json.dumps(rapport));t.replace(p)

def valideer_kalenders(data, url, seizoen):
    if not isinstance(data,list) or not data or len(data)>500:
        raise ValueError('Ongeldige kalenderlijst')
    ids=set()
    for k in data:
        if k.get('bron')!=url or k.get('seizoen')!=seizoen or k.get('spelvorm') not in ('Veld','Zaal') or not k.get('bronId') or k['bronId'] in ids:
            raise ValueError('Kalenderdata hoort niet eenduidig bij dit document/seizoen')
        ids.add(k['bronId'])
        dagen=k.get('dagen');gezien=set()
        if not isinstance(dagen,list):raise ValueError('Geen dagenlijst')
        begin,einde=seizoen.split('-')
        for d in dagen:
            datum=d.get('datum','')
            if datetime.strptime(datum,'%Y-%m-%d').strftime('%Y-%m-%d')!=datum or datum in gezien or not begin+'-07-01'<=datum<einde+'-08-01' or d.get('status') not in ('speeldag','reserve','slotdag'):
                raise ValueError('Ongeldige kalenderdag')
            gezien.add(datum)
    verwacht={k['bronId'] for k in json.loads((ROOT/'catalogus'/'kalenders-2026-2027.json').read_text()) if k['bron']==url and k['seizoen']==seizoen}
    if not verwacht.issubset(ids):raise ValueError('Bestaande bronprofielen ontbreken; beoordeel het volledige document')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--omgeving',choices=['test','productie'],required=True)
    sub=p.add_subparsers(dest='actie',required=True)
    sub.add_parser('controleer');sub.add_parser('testmail')
    a=sub.add_parser('accepteer');a.add_argument('document');a.add_argument('sha');a.add_argument('--kalenders',type=Path);a.add_argument('--geen-inhoudelijke-wijziging',action='store_true')
    args=p.parse_args()
    basis=ROOT/'planning_documenten'/args.omgeving;basis.mkdir(parents=True,exist_ok=True)
    with open(basis/'.lock','w') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        config=json.loads((ROOT/'planning_documenten'/'config.json').read_text())
        ontvanger=config['ontvanger']
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',ontvanger):raise ValueError('Ongeldige ontvanger')
        c=database(basis/'controle.db')
        if args.actie=='testmail':
            stuur_mail(args.omgeving,ontvanger,'Testmail · dagelijkse planningcontrole Hockey','<p>Dit is de aangevraagde testmail van hockey@juliaan.eu.</p><p>Dagelijks om 03:00 Nederlandse tijd controleren we alle geregistreerde planningsdocumenten. Bij een nieuw bestand ontvang je een melding voor handmatige beoordeling in de GPT-app. Er is nog geen automatische AI-verwerking of planningswijziging.</p>')
            print('Testmail door mailserver geaccepteerd');return
        if args.actie=='controleer':
            register=json.loads((ROOT/'catalogus'/'planning-documenten.json').read_text())
            controleer(c,register,basis)
            verzend(c,lambda onderwerp,inhoud:stuur_mail(args.omgeving,ontvanger,onderwerp,inhoud))
        else:
            if bool(args.kalenders)==bool(args.geen_inhoudelijke_wijziging):raise ValueError('Kies gecontroleerde kalenderdata of expliciet geen inhoudelijke wijziging')
            d=c.execute('select url,seizoen,laatste from documenten where id=?',(args.document,)).fetchone()
            v=c.execute('select pad from versies where document=? and sha=?',(args.document,args.sha)).fetchone()
            if not d or not v or d[2]!=args.sha or hashlib.sha256(Path(v[0]).read_bytes()).hexdigest()!=args.sha:raise ValueError('Alleen de actuele opgeslagen versie mag worden goedgekeurd')
            if args.kalenders:
                data=json.loads(args.kalenders.read_text())
                valideer_kalenders(data,d[0],d[1])
                container='hockey-pocketbase-test' if args.omgeving=='test' else 'hockey-pocketbase'
                subprocess.run(['docker','exec','-i',container,'sh','-c','cat > /tmp/planning-kalenders.json'],input=json.dumps(data).encode(),check=True,capture_output=True)
                cmd=['docker','exec',container,'/pb/pocketbase','catalogus-kalenders','/tmp/planning-kalenders.json']
                if args.omgeving=='productie':cmd.append('--encryptionEnv=PB_ENCRYPTION_KEY')
                r=subprocess.run(cmd,check=True,capture_output=True,text=True)
                if 'Kalenders bijgewerkt:' not in r.stdout:raise ValueError('Kalenderimport niet bevestigd')
            c.execute('update documenten set geaccepteerd=? where id=?',(args.sha,args.document))
            c.execute("update versies set status='beoordeeld' where document=?",(args.document,))
            c.execute("update versies set status='actief' where document=? and sha=?",(args.document,args.sha));c.commit()
        status(c,basis)
        print('Planningcontrole klaar; status opgeslagen, actieve planning alleen na handmatige acceptatie gewijzigd')

if __name__=='__main__':
    try:main()
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        raise SystemExit('Planningtaak mislukt: '+type(exc).__name__)
