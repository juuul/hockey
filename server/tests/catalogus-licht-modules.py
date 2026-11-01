"""Bewaar alleen publieke statische CDN-modules voor de netwerkloze Chrome-fixture."""
from pathlib import Path
import re
import sys
from urllib.request import build_opener, HTTPRedirectHandler


class GeenRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('Onverwachte CDN-redirect')


root = Path(sys.argv[1]).resolve()
root.mkdir(mode=0o700, parents=True, exist_ok=True)
opener = build_opener(GeenRedirect())
opgehaald = {}


def haal(naam):
    if not re.fullmatch(r'[\w.-]+\.js', naam):
        raise ValueError('Onveilig modulepad')
    if naam not in opgehaald:
        with opener.open('https://mc.static-hw.nl/v2/' + naam, timeout=20) as r:
            data = r.read(2*1024*1024+1)
        if len(data) > 2*1024*1024:
            raise ValueError('Module te groot')
        opgehaald[naam] = data.decode()
        (root / naam).write_bytes(data)
    return opgehaald[naam]


def imports(tekst):
    return re.findall(r'from\s+["\']\./([^"\']+\.js)["\']', tekst)


nodig = []
for naam in imports(haal('match-center.js')):
    if naam.startswith(('useApi-', 'runtime-dom.esm-bundler-')):
        tekst = haal(naam)
        if naam.startswith('runtime-dom.') or ('/device/register' in tekst and 'X-HAPI-Authorization' in tekst):
            nodig.append(naam)
gezien = set()
while nodig:
    naam = nodig.pop()
    if naam in gezien:
        continue
    gezien.add(naam)
    if len(gezien) > 15:
        raise ValueError('Onverwachte moduleafhankelijkheden')
    nodig.extend(imports(haal(naam)))
print('Statische officiële modules bewaard:', len(opgehaald))
