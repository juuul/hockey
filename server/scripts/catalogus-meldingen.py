"""Private, duurzame meldingen; de wedstrijddatabase wordt uitsluitend gelezen."""
from datetime import datetime
import html
import importlib.util
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import time
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
VELDEN = ('datum', 'spelen', 'thuisNaam', 'uitNaam', 'locatie', 'status')


def lees_catalogus(pad):
    with sqlite3.connect(pad.resolve().as_uri() + '?mode=ro', uri=True) as c:
        c.row_factory = sqlite3.Row
        teams = [dict(r) for r in c.execute('''SELECT DISTINCT c.bronId,c.seizoen,c.naam
            FROM catalogus_teams c JOIN teams t ON t.officieelTeam=c.id''')]
        for t in teams:
            t['wedstrijden'] = [dict(r) for r in c.execute('''SELECT bronId,datum,spelen,
                thuisNaam,uitNaam,locatie,status FROM catalogus_wedstrijden
                WHERE seizoen=? AND (thuisBronId=? OR uitBronId=?) ORDER BY datum,bronId''',
                (t['seizoen'], t['bronId'], t['bronId']))]
    return teams


def lees_bronstatus(pad):
    # Ook een fout die al vóór activering optrad moet één melding opleveren.
    with sqlite3.connect(pad.resolve().as_uri() + '?mode=ro', uri=True) as c:
        c.row_factory = sqlite3.Row
        return [dict(r) for r in c.execute('''SELECT DISTINCT k.clubBronId,k.teamBronId,
            c.seizoen,c.naam,k.status FROM catalogus_taken k
            JOIN catalogus_teams c ON c.bronId=k.teamBronId
                AND k.sleutel='team:'||c.bronId||':'||c.seizoen
            JOIN teams t ON t.officieelTeam=c.id WHERE k.status IN ('fout','klaar')''')]


def opdracht(omgeving, team, fout=False):
    doel = f"{team.get('naam') or 'club ' + team['clubBronId']} ({team.get('seizoen', '')}, bron-ID {team.get('teamBronId') or team.get('bronId') or team['clubBronId']})"
    return (f"Controleer het officiële wedstrijdprogramma van {doel} in omgeving {omgeving}. "
            + ('Onderzoek waarom de wedstrijdbron niet bereikbaar is. Controleer zo nodig ook de openbare clubwebsite; omzeil geen toegangsbeperkingen. ' if fout else 'Vergelijk de gemelde wijzigingen met de actuele bron en de opgeslagen planning. ')
            + 'Werk eenduidige officiële wedstrijdgegevens waar mogelijk veilig bij via de bestaande import. '
            'Behoud spelers, leden, historie, eigen afwijkingen, fruit, begeleiding en rijbeurten; respecteer bewuste verwijderingen. '
            'Controleer tegenstander, datum, thuis/uit, aanvang, locatie en de berekende verzameltijd. '
            'Vraag eerst bij twijfel, conflicten of noodzakelijke codewijzigingen. Ontbrekende gegevens niet gokken. '
            'Rapporteer wat al automatisch is bijgewerkt en wat nog openstaat. Zet geen nieuwe code live zonder mijn toestemming.')


def mailtekst(omgeving, team, uitleg, fout=False):
    moment = datetime.now(ZoneInfo('Europe/Amsterdam')).isoformat(timespec='seconds')
    prompt = opdracht(omgeving, team, fout) + '\n\nMelding van ' + moment + ':\n' + uitleg
    return ('<p>' + html.escape(uitleg).replace('\n', '<br>') + '</p><p>Omgeving: ' + html.escape(omgeving)
            + '</p><p><a href="https://www.hockey.nl/match-center">Officiële wedstrijdbron</a></p>'
            + '<h3>Kopieer deze opdracht naar de chat</h3><pre style="white-space:pre-wrap">'
            + html.escape(prompt) + '</pre>')


class Meldingen:
    def __init__(self, pad, omgeving):
        self.omgeving = omgeving
        pad.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.c = sqlite3.connect(pad)
        os.chmod(pad, 0o600)
        self.c.executescript('''
            CREATE TABLE IF NOT EXISTS snapshots(sleutel TEXT PRIMARY KEY, inhoud TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS storingen(sleutel TEXT PRIMARY KEY, actief INTEGER NOT NULL, episode INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS mails(id INTEGER PRIMARY KEY, onderwerp TEXT, html TEXT,
                verzonden REAL, poging REAL, fout TEXT);
        ''')

    def voeg_toe(self, onderwerp, inhoud):
        self.c.execute('INSERT INTO mails(onderwerp,html) VALUES(?,?)', (onderwerp, inhoud))

    def controleer(self, teams, vandaag=None):
        vandaag = vandaag or datetime.now(ZoneInfo('Europe/Amsterdam')).date().isoformat()
        with self.c:
            for t in teams:
                sleutel = t['bronId'] + ':' + t['seizoen']
                inhoud = json.dumps(t['wedstrijden'], sort_keys=True)
                oud = self.c.execute('SELECT inhoud FROM snapshots WHERE sleutel=?', (sleutel,)).fetchone()
                # Eerste start/nieuwe teamkoppeling: bestaande catalogus is de uitgangssituatie.
                if oud:
                    vorige = {w['bronId']: w for w in json.loads(oud[0])}
                    regels = []
                    for w in t['wedstrijden']:
                        v = vorige.get(w['bronId'])
                        if max(w['datum'], v['datum'] if v else '') < vandaag:
                            continue
                        if not v:
                            regels.append(f"Nieuw: {w['datum']} · {w['thuisNaam']} – {w['uitNaam']} · aanvang {w['spelen'] or 'nog onbekend'}")
                        else:
                            verschillen = [f"{k}: {v[k] or 'nog onbekend'} → {w[k] or 'nog onbekend'}" for k in VELDEN if v[k] != w[k]]
                            if verschillen:
                                regels.append(f"{w['datum']} · {w['thuisNaam']} – {w['uitNaam']}: " + '; '.join(verschillen))
                    if regels:
                        uitleg = ('Officiële programma-updates zijn geïmporteerd. Eenduidige wedstrijden vullen de teamplanning aan; '
                                  'eigen afwijkingen, taken en verwijderingen blijven behouden. Conflicten kunnen nog beoordeling vragen.\n'
                                  + '\n'.join(regels))
                        self.voeg_toe('Wedstrijdprogramma bijgewerkt · ' + t['naam'],
                                      mailtekst(self.omgeving, t, uitleg))
                self.c.execute('INSERT OR REPLACE INTO snapshots VALUES(?,?)', (sleutel, inhoud))

    def bronresultaat(self, taak, fout=None):
        sleutel = ':'.join((taak.get('clubBronId', ''), taak.get('teamBronId', ''), taak.get('seizoen', '')))
        with self.c:
            oud = self.c.execute('SELECT actief,episode FROM storingen WHERE sleutel=?', (sleutel,)).fetchone()
            if fout is None:
                if oud:
                    self.c.execute('UPDATE storingen SET actief=0 WHERE sleutel=?', (sleutel,))
                return
            if oud and oud[0]:
                return
            episode = (oud[1] if oud else 0) + 1
            self.c.execute('INSERT OR REPLACE INTO storingen VALUES(?,1,?)', (sleutel, episode))
            # Geen ruwe subprocess-output: die kan omgevings- of andere privégegevens bevatten.
            code = re.search(r'Bron HTTP (\d{3})', str(fout))
            reden = 'HTTP ' + code[1] if code else 'ophalen of importeren mislukt'
            uitleg = ('De controle van de wedstrijdbron is mislukt (' + reden + '). '
                      'De bestaande planning is behouden en is mogelijk niet actueel. '
                      'Dit is één melding voor deze storing; na een geslaagde controle kan een nieuwe storing opnieuw worden gemeld.')
            self.voeg_toe('Wedstrijdbron niet bijgewerkt · ' + (taak.get('naam') or taak.get('teamBronId') or taak['clubBronId'] or 'clublijst'),
                          mailtekst(self.omgeving, taak, uitleg, True))

    def verzend(self, verstuur, nu=None):
        nu = time.time() if nu is None else nu
        # Maximaal drie mails per ronde; mislukte verzending na een uur opnieuw.
        for ident, onderwerp, inhoud in self.c.execute('''SELECT id,onderwerp,html FROM mails
                WHERE verzonden IS NULL AND (poging IS NULL OR poging<=?) ORDER BY id LIMIT 3''', (nu - 3600,)).fetchall():
            with self.c:
                self.c.execute('UPDATE mails SET poging=? WHERE id=?', (nu, ident))
            try:
                verstuur(onderwerp, inhoud)
                with self.c:
                    self.c.execute('UPDATE mails SET verzonden=?,fout=NULL WHERE id=?', (nu, ident))
            except (OSError, ValueError, subprocess.SubprocessError) as exc:
                with self.c:
                    self.c.execute('UPDATE mails SET fout=? WHERE id=?', (type(exc).__name__, ident))
                print('Catalogusmail wacht op herpoging:', type(exc).__name__)


def verzend_geconfigureerd(meldingen):
    config = json.loads((ROOT / 'planning_documenten' / 'config.json').read_text())
    ontvanger = config['ontvanger']
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', ontvanger):
        raise ValueError('Ongeldige ontvanger')
    spec = importlib.util.spec_from_file_location('planning_mail', ROOT / 'scripts' / 'planning-documenten.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    meldingen.verzend(lambda onderwerp, inhoud: module.stuur_mail(meldingen.omgeving, ontvanger, onderwerp, inhoud))
