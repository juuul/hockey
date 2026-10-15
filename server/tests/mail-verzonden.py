"""Test IMAP-archivering zonder netwerk of echte accounts."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from email import policy
from email.parser import BytesParser

spec = importlib.util.spec_from_file_location("mail_verzonden", Path(__file__).parents[1] / "scripts/mail-verzonden.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ENV = {"IMAP_SENT_ENABLED": "1", "SMTP_HOST": "example.invalid", "SMTP_USER": "sender@example.invalid", "SMTP_PASS": "fake"}
ITEM = {"id": "test123", "datum": "2026-10-15T12:00:00.000Z", "from": {"address": "sender@example.invalid", "name": "Hockey"}, "to": [{"address": "test@example.invalid"}], "subject": "Wachtwoord wijzigen", "html": "<p>Fictieve resetlink</p>", "text": "Fictieve resetlink"}


class Imap:
    def __init__(self):
        self.saved = []
        self.fail = False
        self.uncertain = False
    def __call__(self, *args, **kwargs):
        assert kwargs["ssl_context"].check_hostname
        return self
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def login(self, *args): pass
    def list(self): return "OK", [b'(\\HasNoChildren \\Sent) "/" "Sent"']
    def select(self, folder):
        assert folder == '"Sent"'
        return "OK", []
    def uid(self, *args): return "OK", [b"1" if self.saved else b""]
    def append(self, folder, flags, date, content):
        if self.fail:
            return "NO", []
        self.saved.append(content)
        if self.uncertain:
            raise TimeoutError()
        return "OK", []


class TestVerzonden(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "test.json"
        self.path.write_text(json.dumps(ITEM))
        self.imap = Imap()

    def test_inhoud_en_deduplicatie(self):
        module.verwerk(self.temp.name, ENV, self.imap)
        self.assertFalse(self.path.exists())
        msg = BytesParser(policy=policy.default).parsebytes(self.imap.saved[0])
        self.assertEqual(msg["To"], "test@example.invalid")
        self.assertEqual(str(msg["Subject"]), ITEM["subject"])
        self.assertIn("Fictieve resetlink", msg.get_body(preferencelist=("html",)).get_content())
        self.path.write_text(json.dumps(ITEM))
        module.verwerk(self.temp.name, ENV, self.imap)
        self.assertEqual(len(self.imap.saved), 1)

    def test_fout_bewaart_wachtrij(self):
        self.imap.fail = True
        with self.assertRaises(RuntimeError):
            module.verwerk(self.temp.name, ENV, self.imap)
        self.assertTrue(self.path.exists())
        self.imap.fail = False
        module.verwerk(self.temp.name, ENV, self.imap)
        self.assertFalse(self.path.exists())

    def test_onzekere_append_geen_dubbele_kopie(self):
        self.imap.uncertain = True
        with self.assertRaises(TimeoutError):
            module.verwerk(self.temp.name, ENV, self.imap)
        self.assertTrue(self.path.exists())
        module.verwerk(self.temp.name, ENV, self.imap)
        self.assertEqual(len(self.imap.saved), 1)

    def test_testomgeving_raakt_mailbox_niet(self):
        module.verwerk(self.temp.name, {**ENV, "HOCKEY_ENV": "test"}, self.imap)
        self.assertTrue(self.path.exists())
        self.assertEqual(self.imap.saved, [])


if __name__ == "__main__":
    unittest.main()
