# Voorstellen voor wisselen op het veld

Zelfstandige klikbare ontwerpmockups, uitsluitend ter beoordeling op de testpagina `/test/ontwerpen/spelerwissels/`. Geen onderdeel van het echte Dashboard, geen API, geen account-/teamgegevens en geen opslag. De namen, score en tellers zijn fictief. De CSP blokkeert netwerkverbindingen vanuit de mockup. Deze ontwerpbestanden niet meenemen naar productie zonder een aparte opdracht.

1. **Tik & tik:** tik een veld- of bankspeler aan en daarna de bestemming. Veld ↔ bank is een wissel; veld ↔ veld of een lege plek is verplaatsen. Opstelling corrigeren is een afzonderlijke, zichtbare keuze zonder telling. Dit is het aanbevolen uitgangspunt.
2. **Kies de actie:** eerst Wisselen of Posities kiezen. De tweede speler voert direct uit. Na een correctie terug naar Wisselen, zodat een volgende gewone wissel weer meetelt.
3. **Sleep of tik:** dezelfde betekenis op basis van bron en bestemming; slepen toont vóór loslaten wat de actie doet. Twee keer tikken blijft mogelijk. Loslaten buiten een geldige plek annuleert.

Een echte wissel verhoogt alleen de teller van de uitgaande veldspeler, onafhankelijk van de klok. Keeperhandelingen en correcties tellen niet mee. Geen bevestigingsknop; Herstel maakt alleen een mockupactie ongedaan. Spelerskleuren blijven informatie over invalvolgorde; selectie heeft een aparte blauwe ring. De demo bevat een voorbeeldknop voor een lege plek.

De drie eerste schermbeelden staan in `optie-1.png`, `optie-2.png` en `optie-3.png`; `overzicht.png` toont de voorstellen naast elkaar. De pagina is op een telefoon per tabblad te bekijken. De afbeeldingen zijn met headless Chrome uit dezelfde HTML gemaakt.

Bij een eventuele latere implementatie: gebruik de bestaande `wissel`, `verplaats`, `plaatsIn` en Undo-acties, bestaande bewerkrechten en telefoonterug. Het prototype bevat alleen voorbeeldgedrag en vervangt geen bedrijfslogica. Pas het echte Dashboard pas aan na de keuze/opdracht van de gebruiker.
