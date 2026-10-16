#!/usr/bin/env python3
"""Maak een geanonimiseerde planning-export; de bron wordt uitsluitend read-only geopend."""
import argparse
import hashlib
import json
import os
import sqlite3
from pathlib import Path


def exporteer(database, bronteam, doelteam):
    db = sqlite3.connect(Path(database).resolve().as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    def rows(tabel, velden):
        return [dict(r) for r in db.execute(f'SELECT {velden} FROM {tabel} WHERE team=? ORDER BY id', (bronteam,))]
    def nieuw(soort, id):
        return hashlib.sha256(f'hockey-demo:{doelteam}:{soort}:{id}'.encode()).hexdigest()[:15]
    spelers = rows('spelers', 'id, voorkeur1, voorkeur2')
    if not 1 <= len(spelers) <= 50:
        raise ValueError('Onverwachte teamgrootte')
    ids = {s['id']: nieuw('speler', s['id']) for s in spelers}
    kinderen = ['Amber', 'Bo', 'Cleo', 'Dina', 'Elin', 'Fenne', 'Gwen', 'Hanna', 'Ilse', 'Jade', 'Kiki', 'Lena', 'Mina', 'Nina']
    fake = [{**s, 'id': ids[s['id']], 'naam': 'Demo ' + (kinderen[i] if i < len(kinderen) else str(i + 1))} for i, s in enumerate(spelers)]
    clubs = rows('clubs', 'id, naam')
    clubids = {c['id']: nieuw('club', c['id']) for c in clubs}
    clubs = [{**c, 'id': clubids[c['id']], 'laatstGebruikt': 0} for c in clubs]
    programma = rows('programma', 'id, datum, tot, soort, thuis, spelen, verzamelen, verzamelDatum, clubId, tegenstander, fruit, begeleider1, begeleider2, bronId, bronBasis, bronPlanning, bronStatus')
    for p in programma:
        p['id'] = nieuw('programma', p['id'])
        p['thuis'] = bool(p['thuis'])
        p['clubId'] = clubids.get(p['clubId'], '')
        for taak in ['fruit', 'begeleider1', 'begeleider2']:
            p[taak] = '-' if p[taak] == '-' else ids.get(p[taak], '')
        # Geen vrije opmerkingen, privévertrek-/wedstrijdadressen, gebruikers of contactgegevens.
        for veld, toegestaan in [('bronBasis', ['datum', 'spelen', 'thuis', 'tegenstander']), ('bronPlanning', ['id', 'datum', 'status', 'bron', 'spelvorm', 'kalender'])]:
            waarde = json.loads(p[veld]) if p[veld] else None
            p[veld] = {k: waarde[k] for k in toegestaan if k in waarde} if isinstance(waarde, dict) else None
        p.update(notitie='Fictieve testplanning' if p['soort'] == 'wedstrijd' else 'Geen wedstrijd', rijders=[], bronWijziging=None, locatieAdres='', reisMinuten=None, verzamelModus='automatisch')
        if p['soort'] == 'wedstrijd' and not p['thuis'] and p['fruit']:
            p['rijders'] = [p['fruit']] + [''] * ((len(fake) + 3) // 4 - 1)
    record = db.execute('SELECT stand FROM standen WHERE team=?', (bronteam,)).fetchone()
    oud = json.loads(record['stand']) if record else {}
    standspelers = {}
    for s in spelers:
        vorig = oud.get('spelers', {}).get(s['id'], {})
        standspelers[ids[s['id']]] = {k: vorig.get(k, v) for k, v in dict(positie='LW', inVeld=False, meedoen=True, isKeeper=False).items()}
        standspelers[ids[s['id']]].update(wisselCount=0, inVolgorde=0)
    stand = dict(spelers=standspelers, wisselingen=[], score=dict(wij=0, zij=0), doelpunten=[], opstelling=oud.get('opstelling', '2-3-3'), timer=dict(gestartOp=None, opgebouwd=0), wisselsAltijdTellen=False, wedstrijd=dict(datum=None, clubId=None, thuis=True), shootouts=[], speeltijd=[])
    db.close()
    return dict(doelteam=doelteam, naam='MO-11-1 · Fictief', spelers=fake, clubs=clubs, programma=programma, stand=stand)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--database', required=True)
    parser.add_argument('--bronteam', required=True)
    parser.add_argument('--doelteam', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    data = exporteer(args.database, args.bronteam, args.doelteam)
    # Uitsluitend gegenereerde, gesaneerde testdata. Geen echte spelersnamen worden ingelezen.
    with open(args.output, 'x', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    os.chmod(args.output, 0o644)
    print(f"DEMO_EXPORT_OK: {len(data['spelers'])} fictieve spelers, {len(data['programma'])} datums; geen echte namen/contacten/vrije teksten.")
