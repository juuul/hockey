#!/usr/bin/env python3
"""Feedbackmail: aparte afzender, geen secrets in argumenten of wachtrij."""
from datetime import datetime, timezone
from email.message import EmailMessage
from email.policy import SMTP
import importlib.util
import json
import os
from pathlib import Path
import smtplib
import ssl
import sys


def bericht(item, env):
    test = env.get('HOCKEY_ENV') == 'test'
    ontvangen = 'feedback@example.invalid' if test else env['FEEDBACK_MAIL_TO']
    msg = EmailMessage(policy=SMTP)
    msg['From'] = 'Feedback TEST <feedback@example.invalid>' if test else env['FEEDBACK_MAIL_FROM']
    msg['To'] = item['email'] if item['soort'] == 'bevestiging' else ontvangen
    msg['Reply-To'] = ontvangen if item['soort'] == 'bevestiging' else (item['email'] or ontvangen)
    msg['Date'] = datetime.fromisoformat(item['datum'].replace('Z', '+00:00'))
    msg['Message-ID'] = '<feedback-' + item['id'] + '@juliaan.eu>'
    if item['soort'] == 'bevestiging':
        msg['Subject'] = 'Bedankt voor je feedback'
        msg.set_content('Bedankt! Je feedback is ontvangen door Juliaan.\n\n'
                        'Je kunt op deze mail antwoorden als je iets wilt toevoegen.\n'
                        'Heb je geen feedback ingestuurd? Dan kun je deze mail negeren.\n\nJuliaan')
    else:
        msg['Subject'] = 'Feedback: ' + item['app']
        msg.set_content('App: ' + item['app'] + '\nNaam: ' + (item['naam'] or 'Niet ingevuld') +
                        '\nE-mail: ' + (item['email'] or 'Niet ingevuld') + '\n\n' + item['bericht'] +
                        '\n\nBeheren: https://juliaan.eu/feedback-beheer.html\n')
    return msg


def verstuur(pad, env=None, verbinden=None):
    env = os.environ if env is None else env
    item = json.loads(Path(pad).read_text())
    msg = bericht(item, env)
    test = env.get('HOCKEY_ENV') == 'test'
    if test:
        with (verbinden or smtplib.SMTP)('mailpit', 1025, timeout=20) as smtp:
            smtp.send_message(msg)
        return {'verzonden': True}
    if env.get('FEEDBACK_SMTP_PORT') != '465':
        raise ValueError('Feedback vereist SMTP met SSL op poort 465')
    with (verbinden or smtplib.SMTP_SSL)(env['FEEDBACK_SMTP_HOST'], 465, context=ssl.create_default_context(), timeout=20) as smtp:
        smtp.login(env['FEEDBACK_SMTP_USER'], env['FEEDBACK_SMTP_PASS'])
        smtp.send_message(msg)
    # Geen SMTP-herhaling wanneer uitsluitend het opslaan van de archiefkopie mislukt.
    try:
        mapje = Path(pad).parent.parent / 'feedback-verzonden'
        mapje.mkdir(mode=0o700, parents=True, exist_ok=True)
        kopie = {'id': item['id'], 'datum': item['datum'],
                 'from': {'name': 'Juliaan - Feedback', 'address': env['FEEDBACK_SMTP_USER']},
                 'to': [{'address': str(msg['To'])}], 'subject': str(msg['Subject']),
                 'text': msg.get_content(), 'headers': {'Reply-To': str(msg['Reply-To'])}}
        tijdelijk = mapje / (item['id'] + '.tmp')
        fd = os.open(tijdelijk, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as handle:
            json.dump(kopie, handle)
        tijdelijk.replace(mapje / (item['id'] + '.json'))
    except Exception:
        print('Feedbackmail verzonden; archiefkopie kon niet worden klaargezet', file=sys.stderr)
    return {'verzonden': True}


def archiveer(mapnaam):
    if os.environ.get('HOCKEY_ENV') == 'test':
        return
    spec = importlib.util.spec_from_file_location('mail_verzonden', Path(__file__).with_name('mail-verzonden.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    env = dict(os.environ)
    env.update(IMAP_SENT_ENABLED='1', IMAP_HOST=env['FEEDBACK_IMAP_HOST'],
               IMAP_PORT=env.get('FEEDBACK_IMAP_PORT', '993'), IMAP_USER=env['FEEDBACK_SMTP_USER'],
               IMAP_PASS=env['FEEDBACK_SMTP_PASS'], IMAP_SENT_FOLDER=env.get('FEEDBACK_IMAP_SENT_FOLDER', 'Sent'))
    module.verwerk(mapnaam, env)


if __name__ == '__main__':
    try:
        if sys.argv[1] == 'verstuur':
            print(json.dumps(verstuur(sys.argv[2])))
        elif sys.argv[1] == 'archiveer':
            archiveer(sys.argv[2])
        else:
            raise ValueError('Onbekende actie')
    except Exception:
        print('Feedbackmailactie mislukt; geen inhoud of credentials gelogd', file=sys.stderr)
        sys.exit(1)
