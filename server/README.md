# Hockey-server

Productie en test hebben ieder een eigen PocketBase-proces, database, accounts en mailbox. Frontendopslag is eveneens gescheiden. Nooit de testdatabase over productie kopiëren.

## Test starten en bijwerken

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

De worker kan elke minuut draaien; een lock voorkomt overlap, maximaal drie taken per ronde. De server vraagt dagelijks updates aan voor gekoppelde teams. Andere clubs worden uitsluitend op verzoek opgehaald. De clublijst kan apart worden gecontroleerd:

```sh
python3 server/scripts/catalogus-worker.py --omgeving test --clubs
```

Voor productie bestaat dezelfde opdracht met `--omgeving productie`; pas inzetten na een gecontroleerde livegang. Bron-ID's voorkomen dubbele imports. Eigen verzameltijden, taken, opmerkingen en afwijkingen blijven behouden; bewust verwijderde bronwedstrijden blijven weg. CLI-imports sturen geen realtime-events tussen processen; de app haalt updates via zijn gewone periodieke sync op.

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
