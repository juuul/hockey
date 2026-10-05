# Hockey Wissel-app

Web-app om langs het veld (op een telefoon) de opstelling, wissels, score en tijd bij te houden voor een meidenteam. Zonder team staat alles alleen op de telefoon (localStorage). Ingelogd met een team worden spelers (naam + voorkeuren), clubs en afgesloten wedstrijden gedeeld via een eigen PocketBase-server (zie **Server**), en de lopende wedstrijd (opstelling, wissels, score, scorers, timer, aanwezigheid, wedstrijdgegevens) live.

- Live: https://hockey.juliaan.eu/ (branch `main`)
- Test: https://hockey.juliaan.eu/test/ (branch `test`)
- Oude adressen https://juliaan.eu/hockey/ en /hockey/test/ sturen (GitHub, 301) door naar het nieuwe adres; het deel na `#` blijft bewaard, dus oude links in mails werken.
- Repo: github.com/juuul/hockey

## Werkwijze (belangrijk)
- Werk op branch `test`. Elke wijziging: typecheck (`npx tsc --noEmit -p .`), commit, push naar `test`, wacht op de deploy en controleer de test-URL.
- **CLAUDE.md en `docs/functionaliteit.md` altijd bijwerken** bij elke wijziging in werking, regels of opzet, in dezelfde commit. CLAUDE.md blijft kort (overzicht, werkafspraken, valkuilen); details horen in de docs. Beschrijf hoe het nu is, geen logboek: geen datums, geen "sinds", geen wat-er-gebeurde; vervang verouderde tekst in plaats van eraan toe te voegen.
- Naar `main` (live) alleen als de gebruiker dat expliciet zegt ("zet live", "zet maar door", "naar main"). Dan `git merge --ff-only test` op `main` en pushen.
- De gebruiker is Nederlandstalig en test op de telefoon; antwoord in het Nederlands, kort.
- Touch/uiterlijk op de telefoon kan hier niet getest worden: zeg dat eerlijk en laat de gebruiker het op de telefoon checken. Wel kan een echte headless Chrome via Docker: `docker run --rm --network host zenika/alpine-chrome --no-sandbox --headless=new --virtual-time-budget=8000 --dump-dom <url>` (met `--host-resolver-rules="MAP gc.zgo.at 0.0.0.0"` om een geblokkeerde teller na te bootsen).
- Logica testen op de echte code: schrijf een klein script in de scratchpad dat `src/opstelling.ts` importeert, bundel met `node_modules/.bin/esbuild <script> --bundle --platform=node` en draai het met node.

## Functionaliteit
Kort overzicht; alles in detail (per scherm, alle regels, accounts) staat in **`docs/functionaliteit.md`**: lees dat voordat je aan een scherm of regel werkt, en werk het bij als er iets verandert.

### Tabbladen
Iconen, alle even breed; alleen het actieve tabblad toont zijn naam. Gekozen tabblad blijft staan na inloggen, teamwissel en verversen (`sessionStorage`). ⚠ op het tandwiel bij een echt sync-probleem, rood bolletje bij open aanvragen.
1. **Dashboard** (`src/screens/Dashboard.tsx`): score (Wij → "Wie scoorde?"), veld + keeper, tik op speler = Wissel/Verplaatsen, één rij wissels, klokregel. **Onder de vouw** (bewust uit het zicht): extra wissels, Wedstrijd afsluiten, resets, Undo, timer.
2. **Spelers**: categorie (O12+/O11/O10/O9 = 11/9/8/6 spelers, `CATEGORIE`), opstelling, wie doet mee, toevoegen/verwijderen.
3. **Voorkeur**: per speler (ook keeper) 1e en 2e positie.
4. **Historie**: compacte "Deze wedstrijd" (stand + Afsluiten), balans op één regel, één lijst **Spelers** (doelpunten + speeltijdbalk) en **Wedstrijden** met een filter op tegenstander (club wijzigen via het filter).
5. **Programma** (`src/screens/Programma.tsx`): datums met fruit/spelbegeleiding, "Mijn kind", "Op het veld zetten".
6. **Shoot-out** (alleen O10/O9, `heeftShootouts`): wie nam er hoeveel, minst genomen bovenaan.
7. **Instellingen** (`src/screens/Instellingen.tsx`): inloggen, teams, leden, links uit mails, weergave; superadmin ook "Gebruik per team".

**Niet ingelogd** (`demo`): alles werkt alleen op de telefoon, lege telefoon begint met voorbeeldgegevens (`src/demo.ts`).

### Spelregels (kern, in `src/opstelling.ts`)
- **Wisselteller** +1 bij wie het veld **uit** gaat. Verplaatsen met een wisselspeler is een correctie (`verplaatsSpelers`).
- **Wissels sorteren**: minste wissels eerst; bij gelijk komt wie het laatst eruit ging onderaan.
- **Kleuren** (alleen informatief) op invalvolgorde: laatste 2 rood, 2 oranje (bij 6 spelers 1 en 1), rest groen; keeper geen kleur.
- **Nieuwe opstelling**: eerlijk loten wie begint, dan 1e en 2e voorkeur, rest willekeurig.
- **Wedstrijd afsluiten** slaat op, maar maakt het Dashboard niet leeg: de uitslag blijft (voor iedereen) staan als "Afgelopen" tot er een nieuwe wedstrijd begint (klaarzetten, Nieuwe wedstrijd, of de volgende dag). Beheerders kunnen hem weer openen; opnieuw afsluiten overschrijft dezelfde wedstrijd (`WedstrijdInfo.afgesloten` / `bewerkt`).
- **Alles resetten** / **Undo** (niet de timer): zie de docs.
- **Speelduur** per spelvorm in `src/speelduur.ts` (KNHB); klok stopt vanzelf aan het eind.
- **Speeltijd per speler** (`src/speeltijd.ts`): per linie (aanval/middenveld/verdediging/keeper) plus wissel als eigen groep, gemeten op de wedstrijdklok; wie niet meedoet telt niet. Getoond op de wisseltegels (min), per wedstrijd en per seizoen in Historie.

### Vaste keuzes van de gebruiker
- Geen meldingen (toasts) na een bevestiging; bevestigingsvragen alleen bij resets, timer-stop, iemand uit het team halen en een uitnodiging intrekken.
- **Terugknop van de telefoon** (`useTerug` in `src/terug.ts`): pop-up dicht → subscherm terug → Dashboard → pas dan de app uit. **Nieuwe pop-ups altijd aansluiten.**
- Trek omlaag om te verversen (`Verversen.tsx`), want alleen `.content` scrolt.
- Spelers zijn **rondjes**, geen ovalen.

### Opstellingen
**In beeld altijd hockeytaal: van achter naar voor, zonder keeper** (`opstellingTekst`); positiecodes nooit tonen (`POSITIE_LABEL`). Intern (opslag, server, `OPSTELLINGEN` in `src/types.ts`) staan de namen van voor naar achter; **nooit hernoemen**, anders verandert de betekenis van bewaarde gegevens.

| Spelvorm | In beeld (eerste = standaard) | Intern |
|---|---|---|
| 11 spelers | 3-4-3, 4-3-3 | 3-4-3, 3-3-4 |
| 9 spelers | 3-3-2, 2-3-3, 3-2-3 | 2-3-3, 3-3-2, 3-2-3 |
| 8 spelers (O10) | 2-3-2, 3-3-1, 3-2-2 | 2-3-2, 1-3-3, 2-2-3 |
| 6 spelers | 2-1-2, 1-2-2, 2-2-1 | 2-1-2, 2-2-1, 1-2-2 |

### Team en privacy
- **Spelersnamen: alleen de voornaam**, uniek per team (`naamBezet`; server-index als vangrail).
- **Geen namen van echte speelsters in de repo** (openbaar); testnamen in `src/demo.ts`.

### Accounts en sync (kern)
- Rollen: **beheerder** (alles in het eigen team), **kijker** (alleen meekijken), **superadmin** (eigenaar, alle teams; vlag alleen via het beheerscherm). Alleen een beheerder kan iemand beheerder maken.
- Geen vrij aanmelden: alleen via een uitnodigingslink (dat is ook de e-mailbevestiging). Nieuwe teams en ouders via de aanmeldlink krijgen meteen een uitnodiging; herinnering na 3 dagen, na 7 dagen weg (dagelijkse cron).
- Links uit mails via `location.hash` (`#uitnodiging=`, `#wachtwoord=`, `#aanmelding=`, `#kijk=`, `#aanvraag=`, `#toegang=`).
- **Synchroniseren** (`src/sync.ts`): offline eerst, drie standen per record. **Verwijderen alleen expliciet** (id in `verwijderd`); lokaal ontbreken is nooit een reden om op de server te wissen.
- **Live wedstrijd** (`src/live.ts`): één record per team in `standen`, laatste schrijver wint.

## Mobiel ontwerp (verplicht)
- **Nachtmodus**: Instellingen → Weergave: Automatisch (systeeminstelling, `prefers-color-scheme`), Licht of Donker. Per telefoon in `localStorage.hockey_thema` (test en live samen), toegepast als `data-thema` op `<html>`; `index.html` zet hem al vóór het laden. Logica in `src/thema.ts`. Alle kleuren staan als variabelen in `src/index.css` (`--vlak`, `--tekst`, `--rand`, `--blauw-tekst`, …) met een lichte en een donkere set; **nieuwe CSS altijd met deze variabelen**, geen vaste lichte kleuren. Merk-kleuren van knoppen (blauw, rood, groen) en de keeper (geel) blijven vast.
Bediend op een telefoon van ~10 cm diagonaal (~360px breed):
- **Minimale lettergrootte 22px** via `--base-readable-size` in `src/index.css` (nu 24px); nergens kleiner.
- **Aanraakdoelen minimaal 60px hoog.**
- **Schermvullend** (`100dvh`), geen vaste breedtes/hoogtes. Het dashboard vult precies het scherm; alles wat niet vaak nodig is staat onder de vouw.
- **Veld schaalt mee** via container units (`cqw`/`cqh`): rondje = min(93cqw / breedste rij, 96cqh / aantal rijen incl. keeper), met `--breedste` (min. 3) en `--rijen` (min. 4) op `.field`. Rijen van 4 (11 spelers) krijgen minder rand en 22px letters. Spelers zijn **rondjes** (gebruiker koos tegen ovalen); ze worden alleen breder als een naam niet past.
- **Pop-ups**: gecentreerd, grote tekst en knoppen.
- Test op een smal, laag scherm (360×640).

## Techniek
- React + TypeScript, Vite, gewone CSS per scherm/component (geen Tailwind), state in React Context (`src/context/HockeyContext.tsx`) + localStorage.
- Dev server: `npm run dev` op poort 5173 (`host: true`), bereikbaar via http://192.168.2.50:5173/ (poort 8765 is bezet).
- `src/opstelling.ts`: pure functies (loting, tellers, afmelden, plaatsen, opstelling aanpassen, kleuren, sorteren) — hier logica toevoegen en testen.
- `src/historie.ts`: pure functies voor wedstrijden/clubs (balans, topscorers, per tegenstander, zoeken, datum).
- Datamodel in `src/types.ts` (`Player`: `inVeld`, `meedoen`, `inVolgorde`, `wisselCount`, `isKeeper`).
- `src/foutmelder.ts` + `src/components/Foutvanger.tsx`: JS-fouten, mislukte beloftes, crashes (met "Opnieuw laden"-scherm) en herladen door oude cache gaan naar `POST /api/hockey/fout` (max 5 per keer laden, dubbel één keer, 30 per uur per bezoeker, laatste 1000 bewaard; adres zonder # en ?). Lezen: superadmin, of Claude alleen-lezen via sqlite op `server/pb_data/data.db` (tabel `foutmeldingen`).
- `src/statistiek.ts`: GoatCounter (`juuul.goatcounter.com`); `tel('knop')` telt klikken, alleen in de gepubliceerde build, op test met voorvoegsel `test/`.

### Opslag (localStorage)
Sleutels `hockey_<naam>` op live en `hockey_test_<naam>` op test (zelfde domein, dus gescheiden); met een actief team `hockey[_test]_t_<teamId>_<naam>` (plus `basis` en `overnemen_gevraagd`). Los daarvan: `auth`, `teams`, `actief_team`. Gegevens: `spelers`, `wisselingen`, `vaste_posities` (per speler `[1e, 2e]`), `score`, `doelpunten` (scorer-id's of null), `opstelling`, `timer`, `clubs`, `wedstrijd` (lopende: datum/clubId/thuis), `wedstrijden` (afgesloten, zie `GespeeldeWedstrijd`). Bij nieuwe velden altijd migreren vanuit oude opgeslagen data (zie bestaande voorbeelden in de context). Opslag is per toestel/browser: andere telefoons zien andere data.

## Server (PocketBase)
- Map `server/`: `Dockerfile` + `docker-compose.yml` (container `hockey-pocketbase`, alleen `127.0.0.1:8090`), `pb_migrations/` (collecties + rechten), `pb_hooks/` (uitnodigingen mailen/aannemen). Data in `server/pb_data/` (niet in git).
- CORS (`--origins` in de Dockerfile) en `TOEGESTAAN` (hooks) kennen zowel hockey.juliaan.eu als het oude juliaan.eu/hockey.
- Openbaar alleen `/api` via **Tailscale Funnel** (adres in `src/server.ts`, overschrijfbaar met `VITE_SERVER`). Beheerscherm `/_/` alleen via tailnet (poort 8443) of een SSH-tunnel naar `127.0.0.1:8090`.
- **Mail** vanaf `hockey@juliaan.eu` (mailbox in het Vimexx-hostingpakket, DirectAdmin; SPF/DKIM/DMARC in Cloudflare). Instellingen uit `server/.env` (`SMTP_HOST`, `SMTP_PORT` 465/587, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, zie `server/.env.example`); `mailInstellen` in `pb_hooks/hockey.js` zet ze bij het starten. Het wachtwoord staat **alleen in het geheugen**, nooit in de database (ook niet na opslaan in het beheerscherm); mailinstellingen dus niet in het beheerscherm wijzigen. Afzender moet `@juliaan.eu` zijn (DMARC `p=reject`). Max 150 mails per uur over alle mails (`telMail`, Vimexx staat 200 toe); herinneringen met 2 s pauze. Testen: `python3 server/testmail.py <adres>`. Na wijzigen van `.env`: `docker compose up -d` (een `restart` leest `.env` niet opnieuw).
- **Versleutelde instellingen**: `server/.env` (niet in git, 600) bevat `PB_ENCRYPTION_KEY` (32 tekens); de server start met `--encryptionEnv`, zodat de instellingen (o.a. mailwachtwoord) versleuteld in `data.db` en dus in de back-ups staan. Claude maakt of leest deze sleutel niet; de gebruiker bewaart hem ook in de wachtwoordmanager. Zonder sleutel start de server niet met die database; dan de rij `settings` in `_params` wissen, starten en de instellingen (mail, afzender, appURL) opnieuw invullen; alle teamgegevens blijven.
- **De repo is openbaar**: geen e-mailadressen, wachtwoorden, tokens of andere persoonlijke gegevens committen.
- **Rechten worden op de server afgedwongen** (collection rules). In PocketBase 0.40: relaties vergelijken met `veld.id ?= …` (niet `veld ?= …`), en elke regel begint met `@request.auth.id != ""` (anders telt een lege relatie als match voor bezoekers). Twee keer dezelfde multi-relatie via één `@collection`-alias vergelijkt binnen dezelfde rij; gebruik back-relaties (`teams_via_beheerders.beheerders.id ?= …`).
- Migraties en hooks zitten **in het image** (niet gemount): de echte server verandert pas na `cd server && docker compose up -d --build`. Dat doet de gebruiker, of Claude als de gebruiker erom vraagt; altijd eerst een back-up met sqlite `.backup` naar `server/pb_data/backup-<datum>.db` (niet in git). (Eerder waren ze gemount; PocketBase herlaadde toen vanzelf en voerde een halve migratie uit.)
- **Back-up**: elke nacht 04:00 (crontab) `server/backup.sh`: `data.db` met sqlite `.backup` + integriteitscheck, gzip naar `~/backups/hockey/hockey-<datum>.db.gz` en met rclone naar Google Drive van meijboom, map `hockey-backup` (rclone-config van thuishub, `~/.config/thuishub/rclone`, remote `gdrive`). Alles blijft bewaard (~35 KB per dag); log in `~/backups/hockey/backup.log`. Terugzetten: server stoppen (`docker compose down`), `gunzip` de gewenste kopie naar `server/pb_data/data.db` (eerst de huidige apart zetten, `-wal`/`-shm` weghalen), weer starten.
- Een migratie die al op de server gedraaid heeft **nooit aanpassen**: altijd een nieuwe migratie toevoegen.
- Hooks altijd eerst `node --check server/pb_hooks/*.js` (een syntaxfout laat PocketBase alle hooks overslaan).
- Wijzigingen eerst testen op een losse container met eigen datamap in de scratchpad (poort 8099, nep-SMTP, migraties/hooks daar wél gemount), nooit op de echte data. Voor problemen met echte data: een kopie maken met sqlite `backup()` (alleen-lezen bron) en daarop testen.
- Test en live gebruiken dezelfde server (zelfde accounts en teams). `appURL` (voor de wachtwoordlinks) staat op https://hockey.juliaan.eu/; uitnodigingen en aanmeldingen gaan terug naar de app waar ze vandaan kwamen (`terug`, alleen adressen uit `TOEGESTAAN` in `pb_hooks/hockey.js`).
- Geen mail bij inloggen vanaf een nieuwe plek (PocketBase `authAlert` uit, migratie 1790400015).
- Echte bezoekers-IP via `X-Forwarded-For` (Tailscale zet die), zodat de limieten per bezoeker gelden. Limieten staan aan (PocketBase-standaard + aanmelding).

## Deploy
- GitHub Actions (`.github/workflows/deploy.yml`) bouwt bij elke push naar `main` of `test` **beide** branches en publiceert ze samen als één Pages-site: `main` in de root, `test` in `/test/` (test met `vite build --mode test`).
- Asset-paden zijn relatief (`base: './'`), dus de build werkt op elk pad/domein.
- Eigen adres: GitHub Pages van deze repo heeft custom domain **hockey.juliaan.eu** (CNAME `hockey` → `juuul.github.io`, https afgedwongen). Het domein `juliaan.eu` zelf hoort bij de repo `juuul/juuul.github.io` (startpagina, lokaal in `/home/metime/projects/juuul.github.io`).
- Domein geregistreerd bij Vimexx, **DNS bij Cloudflare** (nameservers `amy`/`nolan.ns.cloudflare.com`, DNSSEC aan): records alleen daar wijzigen. MX naar `spamrelay.zxcs.nl` en SPF/DKIM voor de Vimexx-mailbox staan er met de hand in. **Nameservers nooit terugzetten naar Vimexx** en in Vimexx niets aan de DNS "koppelen": dan is `hockey` weg en klopt DNSSEC niet meer. Controleren: `dig A hockey.juliaan.eu @1.1.1.1` (SERVFAIL = stuk). De lokale resolver op deze machine cachet soms een oud adres; controleer live dan met `curl --resolve hockey.juliaan.eu:443:185.199.108.153 ...`.
- GitHub Pages cachet pagina's tot 10 minuten; de gebruiker ververst door de pagina omlaag te trekken.
- Bij elke publicatie verdwijnen de oude `assets/index-*.js/css`. Een telefoon met de oude `index.html` in de cache kreeg daardoor een leeg scherm; het inline script in `index.html` laadt dan één keer opnieuw met `?v=…` (buiten de cache), `main.tsx` ruimt dat weer op. Alleen reageren op eigen `/assets/`-bestanden: een geblokkeerde GoatCounter gaf eerst een eindeloze herlaad-lus.
