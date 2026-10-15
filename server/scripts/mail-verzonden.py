#!/usr/bin/env python3
"""Bewaar geslaagde app-mails via IMAPS; verstuurt zelf nooit een mail."""
import fcntl
import imaplib
import json
import os
from pathlib import Path
import re
import ssl
import sys
from datetime import datetime
from email.message import EmailMessage
from email.policy import SMTP
from email.utils import format_datetime, formataddr


def bericht(item):
    msg = EmailMessage(policy=SMTP)
    for veld in ("from", "to", "cc", "bcc"):
        adressen = item.get(veld) or []
        if isinstance(adressen, dict):
            adressen = [adressen]
        if adressen:
            msg[veld.title()] = ", ".join(formataddr((a.get("name", ""), a["address"])) for a in adressen)
    msg["Subject"] = item.get("subject", "")
    msg["Date"] = format_datetime(datetime.fromisoformat(item["datum"].replace("Z", "+00:00")))
    # Stabiele id voor deduplicatie na een onzekere APPEND-uitkomst.
    msg["Message-ID"] = "<hockey-sent-" + item["id"] + "@juliaan.eu>"
    for naam, waarde in (item.get("headers") or {}).items():
        if naam.lower() not in {"from", "to", "cc", "bcc", "subject", "date", "message-id", "mime-version", "content-type", "content-transfer-encoding"}:
            msg[naam] = waarde
    msg.set_content(item.get("text") or "")
    if item.get("html"):
        msg.add_alternative(item["html"], subtype="html")
    return msg


def verwerk(mapnaam, env=None, verbinden=None):
    env = os.environ if env is None else env
    if env.get("IMAP_SENT_ENABLED") != "1" or env.get("HOCKEY_ENV") == "test":
        return 0
    mapje = Path(mapnaam)
    mapje.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (mapje / ".lock").open("a") as slot:
        try:
            fcntl.flock(slot, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        items = sorted(mapje.glob("*.json"))[:100]
        if not items:
            return 0
        host = env.get("IMAP_HOST") or env.get("SMTP_HOST")
        user = env.get("IMAP_USER") or env.get("SMTP_USER")
        password = env.get("IMAP_PASS") or env.get("SMTP_PASS")
        if not all((host, user, password)):
            raise ValueError("IMAP-configuratie ontbreekt")
        verbinden = verbinden or imaplib.IMAP4_SSL
        with verbinden(host, int(env.get("IMAP_PORT", "993")), ssl_context=ssl.create_default_context(), timeout=20) as client:
            client.login(user, password)
            folder = env.get("IMAP_SENT_FOLDER")
            if not folder:
                status, folders = client.list()
                if status != "OK":
                    raise RuntimeError("IMAP-mappen ophalen mislukt")
                # SPECIAL-USE is leidend, daarna de Roundcube-standaard Sent.
                for regel in folders or []:
                    if regel and b"\\sent" in regel.lower():
                        match = re.match(rb'\([^)]*\)\s+(?:"[^"]*"|NIL)\s+(.+)$', regel)
                        if match:
                            folder = match[1].decode("ascii")
                            break
                folder = folder or "Sent"
            status, _ = client.select(folder)
            if status != "OK":
                raise RuntimeError("Map Verzonden niet beschikbaar; stel IMAP_SENT_FOLDER in")
            for pad in items:
                msg = bericht(json.loads(pad.read_text()))
                status, bestaand = client.uid("search", None, "HEADER", "Message-ID", '"' + msg["Message-ID"] + '"')
                if status != "OK":
                    raise RuntimeError("IMAP-dubbelcontrole mislukt")
                if not any(bestaand or []):
                    status, _ = client.append(folder, "(\\Seen)", None, msg.as_bytes())
                    if status != "OK":
                        raise RuntimeError("IMAP-kopie opslaan mislukt")
                pad.unlink()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(verwerk(sys.argv[1]))
    except Exception:
        # Geen mailinhoud, resetlinks of serverresponses loggen.
        print("IMAP-archivering mislukt; wachtrij blijft bewaard", file=sys.stderr)
        sys.exit(1)
