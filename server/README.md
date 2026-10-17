# Hockey-server

## Kopieën in Verzonden

Productiecompose schakelt archivering in met `IMAP_SENT_ENABLED=1` en `IMAP_SENT_FOLDER=Sent`. De hook zet na een geslaagde verzending een kopie in `pb_data/mail-verzonden/`. Een lokale werker verwerkt die elke minuut via IMAPS (TLS-certificaatcontrole, standaard poort 993). `IMAP_HOST`, `IMAP_USER` en `IMAP_PASS` vallen terug op de bestaande SMTP-waarden. Er komen geen credentials in de frontend of wachtrij. `IMAP_SENT_FOLDER` kan de map expliciet kiezen; anders wordt de SPECIAL-USE Sent-map gezocht, met `Sent` als terugval. De map moet al bestaan.

De wachtrij bevat volledige mailinhoud, inclusief eventuele resetlinks: maprechten 700, bestandsrechten 600, geen publieke route. Na bevestigde opslag wordt het wachtrijbestand verwijderd. Bij IMAP-uitval blijven kopieën wachten; de oorspronkelijke SMTP-mail wordt nooit opnieuw verstuurd. Een stabiele archief-Message-ID voorkomt dubbele kopieën bij herpogingen. De kopie bewaart afzender, ontvangers, onderwerp en tekst/HTML; de huidige app-mails hebben geen bijlagen. Wachtrijschrijffouten en IMAP-storingen worden zonder mailinhoud gelogd. Een storing bij het klaarzetten na SMTP kan niet automatisch worden hersteld.

Test kan met fictieve mails de wachtrij vullen, maar de werker maakt bij `HOCKEY_ENV=test` nooit verbinding met echte IMAP. Controle: `python3 server/tests/mail-verzonden.py`; hooks ook met `node --check` controleren. Productie bijwerken vereist een afzonderlijke productiedeploy; SMTP-gegevens en encryptiesleutel blijven intact. Dit archiveert alleen nieuwe mails vanaf activering. De losse diagnostische `server/testmail.py` valt buiten de PocketBase-hook.

Productie en test hebben ieder een eigen PocketBase-proces, database, accounts en mailbox. Frontendopslag is eveneens gescheiden. Nooit de testdatabase over productie kopiëren.

## Test starten en bijwerken

### Fictief MO11-1-voorbeeld

`scripts/testteam-voorbeeld.py --database <bron-db> --bronteam <id> --doelteam <test-id> --output <nieuw-bestand>` opent de bron read-only en exporteert uitsluitend gesaneerde testdata. Geen spelersnamen/contacten/gebruikers/vrije teksten of privéadressen worden gelezen. De bronvolgorde van datums en taken wordt gekoppeld aan Demo-voornamen met nieuwe id’s. Het gegenereerde JSON-bestand hoort buiten git.

`scripts/testteam-voorbeeld.pb.js` mag alleen als aparte lokale CLI-hook worden geladen (`--hooksDir`), met `HOCKEY_ENV=test`. De opdracht `testteam-voorbeeld <gesaneerd-bestand>` controleert het doelteam, vervangt binnen één transactie uitsluitend diens spelers, clubs, programma, historie en live stand, en behoudt het team en de leden/rechten. Nooit op productie mounten of als publieke API aanbieden. Eerst de testdatabase back-uppen en de import op een geïsoleerde kopie controleren. Na de import verschijnen records via de gewone gegevenssync; voor nieuwe frontendcode controleert het verversgebaar ook de gepubliceerde assetversie.

Migratie `1790400029_rijden.js` voegt alleen het privé JSON-veld `programma.rijders` toe, onder de bestaande teamrechten. Geen bestaande taak- of teaminstellingen worden overschreven. Test: `tests/rijden.ts` bundelen; `tests/rijden.pb.js` uitsluitend als extra CLI-hook op een nieuwe geïsoleerde database mounten, `test-rijden-fixture` draaien en de server op localhost 8099 starten voor `node server/tests/rijden.mjs`. Beheer kan wijzigen, kijkers alleen lezen en anderen niets. Nooit de fixture op gewone test-/productiedata draaien.

Vanuit de projectmap:

```sh
mkdir -p server/pb_test_data
# De datamap moet schrijfbaar zijn voor containergebruiker 1000.
docker compose -p hockey-test -f server/docker-compose.test.yml up -d --build
```

Test luistert op localhost 8091; Mailpit op localhost 8092. `HOCKEY_ENV=test` gebruikt uitsluitend Mailpit, zonder productiesleutels of SMTP-inlog. Uitnodigings- en resetlinks wijzen naar de testapp. De testfrontend kiest automatisch `https://serverbot.taild1b3c5.ts.net/test`; `VITE_SERVER` kan dit overschrijven voor lokale ontwikkeling.

Funnel heeft twee onafhankelijke API-routes: `/api` naar localhost 8090/api, `/test/api` naar localhost 8091/api. Beheerinterfaces en Mailpit blijven uitsluitend lokaal of in het tailnet. Als je bestaande serverinstellingen wijzigt, controleer dat de productieroute blijft staan.

```sh
tailscale funnel --bg --set-path=/test/api http://127.0.0.1:8091/api
```

Een nieuwe testdatabase bevat geen echte gebruikers. Testmails lees je in Mailpit (lokaal http://127.0.0.1:8092/ of binnen het tailnet https://serverbot.taild1b3c5.ts.net:8444/); ze komen niet in je gewone inbox. Oude testopslag die van productie kwam wordt bij eerste openen van deze versie gewist.

## Openbare catalogus

Alle aan een officieel team gekoppelde privéomgevingen zijn vindbaar via `/api/hockey/catalogus/team/{id}/omgevingen`, ook als een oud record vindbaar=false heeft. Die oude vlag heeft geen effect meer. De publieke respons blijft beperkt tot id, naam en omgevingsnaam. Aanvragen voor een gekoppelde groep blijven nieuw tot een beheerder goedkeurt; vindbaarheid wijzigt geen leden, rollen of privégegevens. Ongekoppelde omgevingen worden niet aan een officieel team toegeschreven.

Controle: `tests/vindbaarheid.pb.js` mag uitsluitend als extra CLI-hook op een nieuwe geïsoleerde database met `HOCKEY_ENV=test` worden gemount. Na migraties maakt `test-vindbaarheid-fixture` drie fictieve groepen. Start die aparte server op localhost 8099 en voer `node server/tests/vindbaarheid.mjs` uit; `test-vindbaarheid-controle` controleert daarna dat aanvragen nog nieuw zijn en geen lidmaatschap/uitnodiging hebben aangemaakt. Nooit deze fixture op de gewone test- of productiedatabase draaien.

Het startbestand bevat uitsluitend openbare club-, team- en wedstrijdgegevens, zonder spelers of contactgegevens. Import is een lokale beheeropdracht die geen API-wachtwoord vereist:

```sh
docker exec -i hockey-pocketbase-test sh -c 'cat > /tmp/catalogus.json' < server/catalogus/start.json
docker exec hockey-pocketbase-test /pb/pocketbase catalogus-import /tmp/catalogus.json
```

Teamselectie vraagt ontbrekende clubteams aan via een begrensde wachtrij. Verwerk die met:

```sh
python3 server/scripts/catalogus-worker.py --omgeving test
```

De worker gebruikt een tijdelijke Chrome-container die de openbare Match Center-pagina bezoekt. Er worden geen clublogins of vaste externe API-sleutels opgeslagen. Alleen een expliciete whitelist van openbare velden gaat naar PocketBase. Fouten en een ander bronseizoen behouden bestaande gegevens. De publieke website is geen gegarandeerd stabiel API-contract.

De optionele browserherstelvariant wordt per omgeving aangezet met het private markerbestand `planning_documenten/<omgeving>/catalogus-browser-herstel.actief`. De worker geeft dan `HOCKEY_BRON_BROWSER_HERSTEL=1` aan de browsercontainer door. `catalogus-browser.cjs` wacht de eigen eenmalige 401-herstelronde van de officiële website af, zonder zelf requests te herhalen of sleutels te kopiëren. Tweede 401, 403 en 429 stoppen; een 429 op `/device/register` stopt eveneens direct. De tijdelijke browser wordt gesloten, bestaande catalogus blijft behouden en de gewone storingsmelding blijft werken. Zonder marker blijft de eerdere antwoordkeuze actief. Productieactivering vereist een afzonderlijke livegang; een serverzijdige bronstoring wordt hiermee niet omzeild of gegarandeerd opgelost.

Teamverzoeken bezoeken in die variant direct `https://www.hockey.nl/match-center#/team/<id>|<poule>/program`; geen voorafgaand clubverzoek of extra navigatie. De opgeslagen poule en het verwachte seizoen blijven expliciet begrensd. Gebruik de SCHC-site nooit zonder afzonderlijke toestemming, ook niet als fallback of in een kopieeropdracht. `catalogus-normaliseer.cjs` vertaalt status `announced` met brontijd `00:00` naar onbekende aanvang; geplande tijden worden behouden.

Controle: `node server/tests/catalogus-browser.cjs` test antwoorden, eigen websiteherstel, rate-/toegangsbeperkingen, origin/pad/methode, timeout, listeneropruiming en onbekende tegenover geplande aanvangstijden. `server/tests/catalogus-browser-fixture.cjs` draait in de bestaande Puppeteer-container met `/scripts` en `/tests` read-only gemount en een lege tijdelijke schrijfbare `/resultaat`. Alle netwerkverzoeken worden onderschept en met fictieve data beantwoord: er wordt geen echte wedstrijdbron bezocht. De volledige lezer controleert direct programmabezoek zonder clubverzoek, herstel, expliciete poule, onbekende tijd, toegestane exportvelden, 403/429 en seizoenbescherming.

De worker kan elke minuut draaien; een lock voorkomt overlap, maximaal drie taken per ronde. De server vraagt dagelijks updates aan voor gekoppelde teams. Andere clubs worden uitsluitend op verzoek opgehaald. De clublijst kan apart worden gecontroleerd:

```sh
python3 server/scripts/catalogus-worker.py --omgeving test --clubs
```

Voor productie bestaat dezelfde opdracht met `--omgeving productie`; pas inzetten na een gecontroleerde livegang. Bron-ID's voorkomen dubbele imports. Eigen verzameltijden, taken, opmerkingen en afwijkingen blijven behouden; bewust verwijderde bronwedstrijden blijven weg. CLI-imports sturen geen realtime-events tussen processen; de app haalt updates via zijn gewone periodieke sync op.

### Geregistreerde-poulepilot en evaluatie

`scripts/catalogus-pilot.py` wordt door de bestaande minuutwerker aangeroepen als `planning_documenten/<omgeving>/catalogus-pilot.actief` bestaat. Productieactivering vereist expliciet liveakkoord. De pilot leest gekoppelde officiële teams read-only, dedupliceert op seizoen/veld-zaal/poule en vervangt in die omgeving de oude dagelijkse teamtaken door geplande poulecontroles. Geen nieuwe cron of databasemigratie nodig. Eenmaal per lokale kalenderdag vanaf 00:20 in Europe/Amsterdam; geen extra ochtend-/avondronde. Nieuwe poules worden bij registratie opgehaald en die eerste controle telt voor dezelfde dag mee, ook vóór 00:20. Na uitval/pauze kan een nog niet uitgevoerde dagcontrole later die dag worden ingehaald; een reeds begonnen, mislukte of afgebroken controle wordt niet diezelfde dag herhaald. Oude slots tellen bij de overgang mee. Expliciete clubmetadata voor aanmelden blijft beschikbaar. De ongewijzigde oude ochtendcron kan taakrecords blijven klaarzetten; de pilot gebruikt de geregistreerde pouleplanning in plaats van die records blind uit te voeren. Bij uitgeschakelde pilot blijft de oude afhandeling actief.

Test en productie gebruiken `.catalogus-bron.lock` in de private planningmap om bronbezoeken te serialiseren. De gedeelde `planning_documenten/catalogus-pilot.db` (600) bevat broncache, meetregels en pauze-/budgetstatus. Cache maximaal twee uur, geen vernieuwing van de ophaaltijd bij hergebruik, geen omgevingsspecifieke taak-id’s erin. Eigen pilotgrens: 24 browserpogingen per lokale dag, minstens 120 seconden ertussen. Dit is geen vastgesteld KNHB-quotum en telt browserbezoeken, niet alle onderliggende HTTP-verzoeken. 401/403 pauze minimaal één uur, 429 minimaal zes uur; langere Retry-After wordt geëerbiedigd. Een mislukte controle wordt pas in een volgend gepland slot opnieuw geprobeerd. Bij dagbudget/pauze blijven nog niet begonnen controles wachten; geen snel retryloopje. De bron blijft uitsluitend hockey.nl/KNHB.

Een privébestand `planning_documenten/<omgeving>/catalogus-evaluatie.json` met `id`, `vanaf` en `op` (ISO-datums inclusief tijdzone) plant een eenmalige evaluatiemail. Dit werkt ook als die omgeving de pilot nog niet heeft geactiveerd: de mail zegt dan expliciet dat er onvoldoende/geen pilotmetingen zijn. De bestaande minuutwerker zet de mail op of na `op` klaar in de duurzame mailwachtrij; evaluatie-identiteit en mail worden atomair geregistreerd in `catalogus-mails.db`. SMTP-herpogingen volgen de bestaande mailwachtrij. Laat voor die omgeving dus `catalogus-mails.actief` ingeschakeld. De ontvanger blijft uit de bestaande privéconfig; geen adressen in git. Een server-/SMTP-storing kan verzending uitstellen, maar de evaluatie blijft klaarstaan. De evaluatie wijzigt nooit de actieve scope, code of teamdata.

Het rapport telt alleen echte geregistreerde-poulecontroles voor die omgeving; gedeelde browserervaring wordt daarnaast over test/productie gemeten. Zonder minstens vijf geslaagde controles per geregistreerde poule en vijf echte gedeelde browsercontroles, of bij fouten/onafgeronde controles, geen positief uitbreidingsadvies. Advies blijft slechts een conservatieve indicatie. Geen AI of automatische opschaling. De cijfers staan ook in de kopieerbare opdracht. Tests: `python3 server/tests/catalogus-pilot.py` en de bestaande catalogus-/mail-/browsertests. Fixture- en voorbeeldmails uitsluitend via Mailpit; geen echte KNHB-aanvragen nodig voor unit-/Chrome-fixturetests.

### Wedstrijdbronmails

`scripts/catalogus-meldingen.py` wordt door de bestaande minuutwerker aangeroepen. Activering per omgeving: maak het private markerbestand `server/planning_documenten/test/catalogus-mails.actief` aan; productie krijgt zijn eigen marker alleen bij uitdrukkelijk goedgekeurde livegang. Zonder marker blijven imports werken zonder de nieuwe notificaties. De eerste ronde legt de huidige openbare catalogus vast; bestaande fouttaken van gekoppelde teams worden direct gemeld. Volgende rondes signaleren nieuwe/toekomstige gewijzigde wedstrijden, ook wanneer de vorige import al vóór een procesherstart was voltooid. Een geslaagde import blijft de bestaande veilige synchronisatie gebruiken; geen directe SQLite-writes naar PocketBase.

De private status staat in `planning_documenten/<omgeving>/catalogus-mails.db` (600), gescheiden van de PDF-controle en PocketBase. Alleen publieke team-/wedstrijdvelden worden gelezen; geen spelers, leden, e-mails of privéafspraken. Nieuwe wedstrijden en wijzigingen in datum, thuis/uit, tegenstander, aanvang, locatie en bronstatus geven één overzicht per team/ronde. Eén storingsmelding per bron/team/seizoen tot herstel. Ontvanger uit `planning_documenten/config.json`; echte verzending gebruikt de bestaande lokale mail-CLI, test uitsluitend Mailpit. Een gedeeld mail-lock voorkomt overlap met documentmails. Geen publiek mailendpoint en geen SMTP-/encryptiesleutels uitlezen.

Elke mail bevat een kopieerbare chatopdracht voor broncontrole en veilige verwerking. Eigen waarden/taken/verwijderingen blijven beschermd; conflicten en codewijzigingen vragen overleg. Mislukte mails blijven duurzaam wachten, maximaal drie per ronde en na fouten één herpoging per uur. Zoals bij andere SMTP-wachtrijen is een dubbele mail mogelijk bij crash tussen verzenden en opslaan van de bevestiging. De wedstrijdbron zelf wordt niet vaker bezocht door de notificatiecontrole.

Controle: `python3 server/tests/catalogus-meldingen.py` test baseline, verschilvelden, nieuwe/verplaatste/historische wedstrijden, herstart, storingsdeduplicatie/herstel, SMTP-herpogingen, HTML-escaping, omgeving en read-only bronselectie. Echte testverzending uitsluitend naar Mailpit. Productieactivering verandert geen bronkoppeling: een ontoegankelijke wedstrijdbron blijft beoordeling vragen, geen verzonnen gegevens of automatische alternatieve scraper.

## Controle en livegang

```sh
npx tsc --noEmit -p .
node --check server/pb_hooks/hockey.pb.js
node --check server/pb_hooks/hockey.js
node --check server/pb_hooks/catalogus.pb.js
node --check server/pb_hooks/catalogus.js
node server/tests/catalogus.mjs
npm run build -- --mode test
```

De integratietest gebruikt alleen localhost 8091/8092 en fictieve accounts op `example.com`. Hij controleert twee omgevingen voor hetzelfde officiële team, toegang vóór/na goedkeuring, rollen, linkrotatie, bronupdates, herstel en bewuste verwijdering. Authenticatielimieten blijven aan. Gebruik de test nooit tegen productie.

Bij livegang: eerst een back-up van productie, dan productieimage met migraties uit de goedgekeurde code bijwerken, openbare catalogus importeren, bestaande teamkoppeling controleren en frontend publiceren volgens de branchafspraken in CLAUDE.md. Migratie 1790400020 trekt oude anonieme meekijkaccounts in; deel daarom nieuwe aanvraaglinks. Persoonlijke leden blijven lid. Terugdraaien van databasemigraties gebeurt via een gecontroleerde back-up, niet door nieuwe privégegevens te verwijderen.

### Speeldagenkalenders

`catalogus_kalenders` bevat openbare profielen uit de KNHB-kalenders voor seizoen 2026–2027: alle vijf districten, bondscompetitie en Hockey7s. De bronlinks staan per profiel in `catalogus/kalenders-2026-2027.json`. Een kalender is een planning; tegenstanders en tijden volgen uit de wedstrijdbron. Zaalweekenddagen zijn alternatieven en reservedagen zijn expliciet gemarkeerd. Controleer bij een nieuwe PDF-versie altijd de juiste kolom, periode, klasse, poulegrootte, spelvorm en leeftijdsafhankelijke reservevoetnoten voordat je het JSON-bestand vervangt. Geen automatische extrapolatie naar een volgend seizoen.

Import naar test (productie alleen bij een afzonderlijk geautoriseerde livegang):

```sh
docker exec -i hockey-pocketbase-test sh -c 'cat > /tmp/kalenders.json' < server/catalogus/kalenders-2026-2027.json
docker exec hockey-pocketbase-test /pb/pocketbase catalogus-kalenders /tmp/kalenders.json
```

De lokale CLI importeert in één transactie en vult gekoppelde privéomgevingen aan. Publieke gebruikers hebben alleen leesrechten. De beheerder kiest zo nodig profielen via Programma → Speeldagen plannen. Bestaande afspraken blijven staan; verwijderingen worden onthouden. Een unieke bronwedstrijd neemt de bestaande lege speeldag over, inclusief eigen afspraken.

Controle: `node server/tests/kalenders.mjs` valideert kalenderdata en MO11/O12-reservevoetnoten. `server/tests/speeldagen.pb.js` is een lokale CLI-testhook voor een geïsoleerde testcontainer met een tijdelijke hooksmap; `test-speeldagen` controleert aanvullen, behoud van afspraken, herhaling, verwijderingen en kalenderupdates met fictieve gegevens die in dezelfde transactie worden opgeruimd.

### Google Routes en verzameltijden

De superadmin stelt onder Instellingen de globale voorbereiding (30 min) en buffer (5 min) in. Teambeheerders kunnen privé afwijken. Reistijd handmatig invullen werkt zonder externe koppeling. Automatisch ophalen gebruikt eerst de eigen reisdatabase; voor andere adressen is de officiële Google Routes API optioneel. De integratie bewaart geen Google-routeantwoorden.

Activeren door de eigenaar:

1. Maak in Google Cloud een API-sleutel met ingeschakelde Routes API en de benodigde Google Maps Platform-facturering. Beperk de sleutel tot Routes API en waar mogelijk de uitgaande server-IP’s; stel een passend quotum in. Zie https://developers.google.com/maps/documentation/routes/get-api-key .
2. Test: maak `server/.env.routes.test` (niet in git, chmod 600) met alleen `GOOGLE_MAPS_API_KEY=` en de eigen sleutel als waarde. Het test-composebestand laadt dit optionele bestand automatisch. Gebruik geen productie-`.env` of productiesleutel in test.
3. Start de testserver opnieuw via het eigen composebestand: `docker compose -p hockey-test -f server/docker-compose.test.yml up -d --build`. Een gewone restart leest het env-bestand niet opnieuw.
4. Productie krijgt bij een afzonderlijk geautoriseerde livegang zijn eigen `GOOGLE_MAPS_API_KEY` in `server/.env`; de bestaande PocketBase-versleutelingssleutel wordt niet veranderd.

De app toont beschikbaarheid; hij toont of bewaart de API-sleutel nooit. Routes wordt alleen aangeroepen als een teambeheerder op Reistijd ophalen drukt. Google-aanvragen bevatten geen spelersnamen of gebruikers-id’s. Statische schattingen omvatten geen actuele files. Test de juiste accommodatie, ook voor zaal. Navigatielinks gebruiken Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started .

Controle: bundel `server/tests/verzamelen.ts` met esbuild en voer uit met Node. `server/tests/reizen.pb.js` is een tijdelijke CLI-testhook voor een geïsoleerde testcontainer; `test-google-reis` gebruikt fictieve HTTP-antwoorden en doet geen betaalde Google-aanvraag.

### Eigen router en gedeelde reistijden

Bekende poule-/wedstrijdparen worden één keer berekend en in hele minuten opgeslagen. De cache gebruikt `reis_locaties` en `reis_routes` in de eigen omgevingsdatabase. Alleen openbare club/accommodatieadressen komen in de cache. Google-content wordt hiervoor niet gebruikt of opgeslagen. De eigen autoschatting bevat geen actuele files.

Eenmalige inrichting:

```sh
python3 server/scripts/routing-bouw.py
docker compose -p hockey-routing -f server/docker-compose.routing.yml up -d
python3 server/scripts/reis-worker.py --omgeving test
```

De kaart van Nederland wordt via Geofabrik opgehaald en met het OSRM-autoprofiel verwerkt. Bestanden onder `server/routing_data/` zijn groot, openbaar en uitgesloten van git en de PocketBase Docker-build. De router is gebonden aan localhost:5001, met maximaal één CPU en 3 GB RAM. Kaartbouw is beperkt tot drie CPU’s en 12 GB RAM. Stop de routingcontainer voor een kaartupdate, herbouw tijdens een beheerperiode en start hem daarna weer; dit herberekent bestaande routes niet automatisch.

De reiswerker gebruikt alleen officiële club-/accommodatieadressen, controleert PDOK/BAG op exact postcode, huisnummer/toevoeging en straat, cachet de gevonden punten en verwerkt maximaal 100 nieuwe gerichte paren per run. Geen kruisproduct van alle Nederlandse clubs. Een tijdelijke routerstoring laat nieuwe paren pending en bestaande waarden intact; een ambigu adres wordt als fout gemarkeerd. Geen fictieve nulwaarden.

Test wordt elke minuut verwerkt. Productie krijgt bij geautoriseerde livegang een eigen taak met `--omgeving productie`; de bestaande instellingenversleuteling blijft intact. Beide databases zijn gescheiden; de routingcontainer bevat alleen openbare OSM-weggegevens. In een geïsoleerde testcontainer kan de werker met `--omgeving test --testcontainer hockey-reiscache-check` worden gecontroleerd.

Bronnen: https://www.pdok.nl/pdok-locatieserver , https://github.com/Project-OSRM/osrm-backend , https://download.geofabrik.de/europe/netherlands.html , https://www.openstreetmap.org/copyright . De openbare route-export staat op `/api/hockey/reisdata` en bevat geen private teamdata.

### Automatische verzameltijd

`programma.verzamelModus` is altijd automatisch. Migratie 1790400027 zet ook eerder handmatige en gewiste tijden om. Recordhooks berekenen automatisch met de opgeslagen reistijd; de reiswerker werkt automatische programma-items elke minuut bij. Aanvang/adres onbekend betekent geen verzameltijd. Recordhooks overschrijven ook binnenkomende handmatige verzameltijden met de berekening. `verzamelen-bijwerken` is een lokale CLI voor direct herberekenen.

Controle: `server/tests/verzameltijden.pb.js` als tijdelijke hook op een geïsoleerde testkopie; `test-tijden` controleert thuis/uit, wijzigende aanvang, overschrijven van handmatige en gewiste keuzes, onbekende route en de vorige dag.

### Planningsdocumenten: 03:00-controle en handmatige verwerking

Register: `server/catalogus/planning-documenten.json` bevat 12 openbare bronnen en de SHA256 van de eerder gecontroleerde originele PDF’s. Nieuwe seizoenen/documentlinks worden na beoordeling aan dit register toegevoegd. Alle bronnen worden gecontroleerd, niet alleen gebruikte teamprofielen. De publicatiepagina wordt vergeleken op PDF-links.

Privéconfig: `server/planning_documenten/config.json`, chmod 600, met één `ontvanger` (e-mailadres). Deze map is uitgesloten van git/Docker-build. `test/` en `productie/` bevatten elk `controle.db`, `status.json` en `bestanden/<document-id>/<sha>.pdf`. Bewaar deze map in een private back-up: de bestanden zijn het bewijs voor vergelijking en goedkeuring. De schema-opzet staat in de werker; geen wijzigingen aan de wedstrijddatabase nodig voor controleren/mailen.

```sh
python3 server/scripts/planning-documenten.py --omgeving test controleer
python3 server/scripts/planning-documenten.py --omgeving test testmail
```

Cron draait beide controles om 03:00 op een host met Europe/Amsterdam; productie en test hebben aparte locks/logs. Test gebruikt Mailpit, productie de bestaande SMTP-config in de container. Native PocketBase leest zelf `PB_ENCRYPTION_KEY`; geen hostscript leest productie-`.env`. Mailhooks worden alleen tijdelijk in `/tmp` voor de lokale CLI geladen, nooit via een publiek mailendpoint. Een SMTP-bevestiging is geen bewijs van inboxbezorging.

Na een mail: vraag in de GPT-app om de opgeslagen versie te vergelijken met de geaccepteerde versie (document-ID en SHA staan in mail/status). Verwerk alle profielen van dat document in een lokaal JSON-bestand. Controleer verplaatste/vervallen dagen en eventuele privéteamafspraken expliciet. Pas na gebruikersgoedkeuring:

```sh
python3 server/scripts/planning-documenten.py --omgeving test accepteer DOCUMENT_ID SHA256 --kalenders /pad/naar/gecontroleerde-kalenders.json
# Alleen opmaak veranderd, geen wijziging in planning:
python3 server/scripts/planning-documenten.py --omgeving test accepteer DOCUMENT_ID SHA256 --geen-inhoudelijke-wijziging
```

Productie is een aparte, uitdrukkelijk geautoriseerde acceptatie met `--omgeving productie`; een testacceptatie zet niets live. Alleen de nieuwste bewaarde versie kan geaccepteerd worden, en de fingerprint wordt opnieuw gecontroleerd. Kalenderimport is de bestaande lokale transactie die gekoppelde teams synchroniseert; de controle zelf doet nooit een import. Houd ook het gecontroleerde bron-JSON in de repo actueel bij inhoudelijke wijzigingen.

Controle: `python3 server/tests/planning-documenten.py` test onveranderde/gewijzigde documenten, versiebehoud, deduplicatie, mailretry, downloadfouten, URL-normalisatie en kalenderinvoer. Handmatige controles mogen direct met `controleer` worden gestart; status in de app is alleen voor superadmins.

Mailmeldingen zijn uitsluitend voor updates. Ongewijzigde controles en storingen geven geen mail; fouten staan in status/log. Eventuele oude wachtende storingsmails worden niet meer verzonden.
