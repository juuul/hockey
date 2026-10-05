#!/usr/bin/env python3
"""Stuurt één testmail met de SMTP-gegevens uit server/.env (zelfde als de server).

Gebruik: python3 server/testmail.py jij@voorbeeld.nl
Het wachtwoord wordt nooit getoond.
"""
import os
import smtplib
import socket
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr


def lees_env(pad):
    env = {}
    with open(pad) as f:
        for regel in f:
            regel = regel.strip()
            if not regel or regel.startswith("#") or "=" not in regel:
                continue
            k, v = regel.split("=", 1)
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            env[k.strip()] = v
    return env


def fout(tekst):
    print("FOUT: " + tekst, file=sys.stderr)
    sys.exit(1)


def main():
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        fout("geef één ontvanger op, bijv.: python3 server/testmail.py jij@voorbeeld.nl")
    aan = sys.argv[1]
    env = lees_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    leeg = [k for k in ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM") if not env.get(k)]
    if leeg:
        fout(", ".join(leeg) + " ontbreekt in server/.env")
    host, poort, user, pw = env["SMTP_HOST"], int(env["SMTP_PORT"]), env["SMTP_USER"], env["SMTP_PASS"]
    van = env["MAIL_FROM"]
    if not parseaddr(van)[1].lower().endswith("@juliaan.eu"):
        fout("MAIL_FROM moet een @juliaan.eu-adres zijn (anders faalt DMARC)")

    msg = EmailMessage()
    msg["From"] = van
    msg["To"] = aan
    msg["Subject"] = "Testmail Hockey Wissel-app"
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="juliaan.eu")
    msg.set_content("Dit is een testmail van de hockey-server via " + host + ":" + str(poort) + ".")

    stap = "verbinden"
    try:
        ctx = ssl.create_default_context()
        if poort == 465:
            s = smtplib.SMTP_SSL(host, poort, timeout=20, context=ctx)
        else:
            s = smtplib.SMTP(host, poort, timeout=20)
            stap = "STARTTLS"
            s.starttls(context=ctx)
        with s:
            stap = "inloggen"
            s.login(user, pw)
            stap = "versturen"
            s.send_message(msg)
    except smtplib.SMTPAuthenticationError as e:
        fout("inloggen geweigerd (gebruikersnaam of SMTP_PASS klopt niet): %s %s" % (e.smtp_code, e.smtp_error.decode(errors="replace")))
    except ssl.SSLError as e:
        fout("TLS-probleem bij %s (%s): %s. Klopt de poort? 465 = SSL/TLS, 587 = STARTTLS" % (stap, host, e))
    except smtplib.SMTPNotSupportedError as e:
        fout("server ondersteunt %s niet: %s" % (stap, e))
    except smtplib.SMTPRecipientsRefused as e:
        fout("ontvanger geweigerd: %s" % e.recipients)
    except smtplib.SMTPSenderRefused as e:
        fout("afzender geweigerd (%s): %s %s" % (e.sender, e.smtp_code, e.smtp_error.decode(errors="replace")))
    except smtplib.SMTPException as e:
        fout("SMTP-fout bij %s: %s" % (stap, e))
    except socket.gaierror as e:
        fout("servernaam %s niet gevonden: %s" % (host, e))
    except (ConnectionRefusedError, TimeoutError, socket.timeout) as e:
        fout("geen verbinding met %s:%d (%s)" % (host, poort, e))
    except OSError as e:
        fout("verbindingsfout bij %s met %s:%d: %s" % (stap, host, poort, e))
    print("OK: testmail verstuurd van %s naar %s via %s:%d" % (van, aan, host, poort))


if __name__ == "__main__":
    main()
