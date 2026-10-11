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
