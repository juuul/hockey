"""Controleer berichtopbouw en SMTP-fouten met nepverbindingen, zonder netwerk."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('feedback_mail', Path(__file__).parents[1] / 'scripts/feedback-mail.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ITEM = {'id': 'testmail01', 'soort': 'melding', 'app': 'Hockey', 'naam': '', 'email': '', 'bericht': '<b>Fictieve feedback</b>', 'datum': '2026-10-23T12:00:00Z'}


class FeedbackMail(unittest.TestCase):
    def test_anoniem_geen_contact_en_tekst(self):
        msg = module.bericht(ITEM, {'HOCKEY_ENV': 'test'})
        self.assertEqual(str(msg['To']), 'feedback@example.invalid')
        self.assertIn('<b>Fictieve feedback</b>', msg.get_content())
        self.assertEqual(msg.get_content_type(), 'text/plain')

    def test_bevestiging_geen_bezoekersinhoud(self):
        msg = module.bericht({**ITEM, 'soort': 'bevestiging', 'email': 'test@example.invalid'}, {'HOCKEY_ENV': 'test'})
        self.assertEqual(str(msg['To']), 'test@example.invalid')
        self.assertNotIn('Fictieve feedback', msg.get_content())

    def test_productie_afzender_en_replyto(self):
        msg = module.bericht({**ITEM, 'email': 'inzender@example.invalid'}, {'FEEDBACK_MAIL_TO': 'owner@example.invalid', 'FEEDBACK_MAIL_FROM': 'Feedback <sender@example.invalid>'})
        self.assertEqual(str(msg['Reply-To']), 'inzender@example.invalid')
        self.assertEqual(str(msg['To']), 'owner@example.invalid')

    def test_smtp_fout_geen_succes(self):
        def kapot(*args, **kwargs):
            raise ConnectionError('fictieve storing')
        with tempfile.TemporaryDirectory() as directory:
            pad = Path(directory) / 'mail.json'
            pad.write_text(json.dumps(ITEM))
            with self.assertRaises(ConnectionError):
                module.verstuur(pad, {'HOCKEY_ENV': 'test'}, kapot)
            self.assertTrue(pad.exists())


if __name__ == '__main__':
    unittest.main()
