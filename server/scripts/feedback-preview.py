#!/usr/bin/env python3
"""Maak een testpreview van uitsluitend de publieke feedbackbestanden."""
from pathlib import Path
import shutil

server = Path(__file__).resolve().parents[1]
bron = server.parent.parent / 'juuul.github.io'
doel = server / 'feedback-preview'
bestanden = ['index.html', 'informatie.html', 'feedback.html', 'feedback-beheer.html', 'feedback.css',
             'feedback.js', 'feedback-beheer.js', 'startpagina.js', 'juliaan-qr.svg']
if not all((bron / naam).is_file() for naam in bestanden):
    raise SystemExit('Publieke bron ontbreekt; geen preview voorbereid.')
doel.mkdir(exist_ok=True)
for naam in bestanden:
    shutil.copyfile(bron / naam, doel / naam)
print('Feedbackpreview voorbereid met uitsluitend publieke bestanden.')
