# Mails en processtappen

De persoonlijke uitnodiging bevestigt het e-mailadres en geeft pas na accepteren lidmaatschap. De ongelezen melding in de app staat los van een mail: aanmelden maakt die melding direct zichtbaar; de teambeheerders krijgen pas mail na geslaagde acceptatie en een nieuw lidmaatschap.

| Mail | Moment en ontvanger | Betekenis en volgende stap |
| --- | --- | --- |
| Uitnodiging voor team | Na zelf aansluiten, handmatig uitnodigen of een oude aanvraag toelaten; naar de uitgenodigde ouder/beheerder | Uitgenodigd, nog niet via deze uitnodiging aangesloten. Link accepteren bevestigt e-mailbezit; een nieuw account kiest een wachtwoord. Rol is kijker of beheerder zoals in de uitnodiging. |
| Herinnering uitnodiging | Eenmalig vanaf drie dagen bij een niet geaccepteerde, nog geldige uitnodiging; naar dezelfde ontvanger | Dezelfde link accepteren. Geldig tot zeven dagen na de oorspronkelijke verzending, geen nieuwe zeven dagen. Geen algemene claim dat een team wordt verwijderd. |
| Nieuw lid bij team | Pas nadat de acceptatietransactie lidmaatschap heeft opgeslagen; naar de huidige teambeheerders, niet het nieuwe lid zelf | De uitnodiging is geaccepteerd en de persoon is daadwerkelijk lid. Leden bekijken/blokkeren bij Instellingen → Leden. Geen mail bij aanmelden, link bekijken, mislukte/dubbele acceptatie of een rolwijziging van een bestaand lid. |
| Nieuw team aangemaakt | Nieuwe teamomgeving aangemaakt en beheerdersuitnodiging verstuurd; naar superadmins/ontvangers van teamaanmeldingen | Informatief: de uitnodiging is verstuurd, de aanvrager moet nog accepteren. Geen goedkeuractie of afgeronde accountactivatie suggereren. Dit is een andere ontvangersgroep en stap dan de mail aan teambeheerders over een nieuw lid. |
| Aanvraag afgewezen | Een oude open toegangsaanvraag wordt expliciet afgewezen; naar de aanvrager | Geen uitnodiging/toegang. Bij vragen contact met trainer/teammanager. Nieuwe automatische aanmeldingen gebruiken Blokkeren, niet deze afwijzingsmail. |
| Teamaanmelding afgewezen | Een oude teamaanmelding wordt expliciet afgewezen; naar de aanvrager | Team niet toegelaten via deze oude aanvraag. De gewone nieuwe-teamroute maakt nu direct een omgeving en uitnodiging. |
| Nieuw wachtwoord | Wachtwoord vergeten voor een bestaand account; naar het accountadres | Link naar `#wachtwoord=` in de juiste appomgeving om een nieuw wachtwoord te kiezen. Geen claim over een nieuwe aanvraag of lidmaatschap. Verzoek niet zelf gedaan: mail negeren. Productie- en testconfiguratie zijn gecontroleerd. |
| Wedstrijdprogramma bijgewerkt | Een verschil in de openbare catalogus is opgeslagen en met de eerdere snapshot vergeleken; naar de ingestelde privéontvanger | Officiële gegevens zijn geïmporteerd. Eigen afspraken/taken blijven behouden; conflicten kunnen nog beoordeling vragen. Kopieerbare opdracht vraagt te controleren wat al verwerkt is en wat openstaat. |
| Wedstrijdbron niet bijgewerkt | Eerste fout van een storingsepisode; naar de ingestelde privéontvanger | Bestaande planning behouden, mogelijk verouderd. Geen succes suggereren. Nieuwe melding pas na herstel en een nieuwe storing. Geen tokens of ruwe foutuitvoer in de mail. |
| Nieuwe planningsdocumentversie | Een nog niet goedgekeurde PDF-versie is opgeslagen; naar de ingestelde privéontvanger | Eerst inhoud vergelijken/beoordelen; nog geen inhoudelijke datumwijziging bevestigd. PDF pas na goedkeuring als kalenderbron verwerken. |
| Nieuwe/verwijderde PDF-links | Publicatiepagina bevat andere links dan het documentregister; naar de ingestelde privéontvanger | Links beoordelen en zo nodig register bijwerken; geen claim dat teams al zijn bijgewerkt. |
| Evaluatie poulepilot | Eenmalig na de afgesproken evaluatietijd; naar de ingestelde privéontvanger | Ervaringen en advies, geen automatische uitbreiding. Mailtekst en kopieerbare opdracht noemen dezelfde werkelijke meetperiode, ook bij vertraagde uitvoering. |
| Testmail planningcontrole | Alleen na expliciet uitvoeren van de testmailopdracht | Benoemt dat het een test is en beschrijft de aparte PDF-controle, niet de dagelijkse wedstrijdcontrole om 05:00. |
| Feedbackmelding en ontvangstbevestiging | Na een ontvangen feedbackbericht; beheerder krijgt inhoud, inzender met e-mailadres een ontvangstbevestiging | Ontvangen, nog geen oplossing of toezegging dat een wijziging al verwerkt is. Aparte feedbackfunctie. |
| Contactaanvraag en ontvangstbevestiging | Na een ontvangen aanvraag voor een website/app; eigenaar krijgt inhoud, inzender bevestiging | Idee ontvangen en contact volgt, geen claim dat er al een opdracht is aangenomen of geleverd. Aparte contactfunctie. |

## Standaardmails buiten de appflow

De PocketBase-templates voor e-mailverificatie en e-mailadreswijziging gebruiken standaard Engelstalige teksten met beheerpaneellinks. De app roept deze routes niet aan: e-mailbezit wordt via de uitnodiging bevestigd en er is geen scherm voor e-mailadreswijziging. De OTP- en nieuwe-inloglocatiemeldingen zijn uitgeschakeld. Deze controle voegt geen nieuwe authenticatiemethode toe en schakelt geen standaardmails in. Nieuwe UI voor zulke routes vereist eerst passende appschermen, links en teksten.

De gedeelde feedback/contactfunctie kan op test beschikbaar zijn zonder dat zij op productie is vrijgegeven. Deze mailcontrole activeert die functie niet op productie. Transport en IMAP-archivering maken geen extra mail aan de gebruiker: zij verzenden of bewaren alleen de bestaande berichten.

## Controle

`node server/tests/mailteksten.cjs` controleert de echte uitnodigings-, herinnerings- en afwijzingsfuncties zonder netwerk. De tests voor `planning-documenten.py`, `catalogus-pilot.py`, `catalogus-meldingen.py` en `feedback-mail.py` controleren de bijbehorende teksten/processtappen met fictieve data. De integratietest `teamtoegang.mjs` controleert uitnodiging/acceptatie/melding via een geïsoleerde backend en Mailpit. Een tekstcontrole verstuurt geen echte productiemails en downloadt geen wedstrijdbron of PDF.
