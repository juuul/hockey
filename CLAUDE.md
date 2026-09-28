# Hockey Wissel-app

Web-app om langs het veld (op een telefoon) de opstelling, wissels, score en tijd bij te houden voor een meidenteam. Zonder team staat alles alleen op de telefoon (localStorage). Ingelogd met een team worden spelers (naam + voorkeuren), clubs en afgesloten wedstrijden gedeeld via een eigen PocketBase-server (zie **Server**), en de lopende wedstrijd (opstelling, wissels, score, scorers, timer, aanwezigheid, wedstrijdgegevens) live.

- Live: https://hockey.juliaan.eu/ (branch `main`)
- Test: https://hockey.juliaan.eu/test/ (branch `test`)
- Oude adressen https://juliaan.eu/hockey/ en /hockey/test/ sturen (GitHub, 301) door naar het nieuwe adres; het deel na `#` blijft bewaard, dus oude links in mails werken.
- Repo: github.com/juuul/hockey

## Werkwijze (belangrijk)
- Werk op branch `test`. Elke wijziging: typecheck (`npx tsc --noEmit -p .`), commit, push naar `test`, wacht op de deploy en controleer de test-URL.
- Naar `main` (live) alleen als de gebruiker dat expliciet zegt ("zet live", "zet maar door", "naar main"). Dan `git merge --ff-only test` op `main` en pushen.
- De gebruiker is Nederlandstalig en test op de telefoon; antwoord in het Nederlands, kort.
- Touch/uiterlijk op de telefoon kan hier niet getest worden: zeg dat eerlijk en laat de gebruiker het op de telefoon checken. Wel kan een echte headless Chrome via Docker: `docker run --rm --network host zenika/alpine-chrome --no-sandbox --headless=new --virtual-time-budget=8000 --dump-dom <url>` (met `--host-resolver-rules="MAP gc.zgo.at 0.0.0.0"` om een geblokkeerde teller na te bootsen).
- Logica testen op de echte code: schrijf een klein script in de scratchpad dat `src/opstelling.ts` importeert, bundel met `node_modules/.bin/esbuild <script> --bundle --platform=node` en draai het met node.

## Functionaliteit

### Tabbladen
1. **Dashboard**
   - Bovenaan de scoreregel: `[−] [Wij n] [Zij n] [−]`. Tik op **Wij** opent "Wie scoorde?" (veld van voor naar achter, dan keeper, dan wissels, of "Weet ik niet"). **Zij** telt direct +1. `−` bij Zij haalt er één af; `−` bij Wij vraagt "Welk doelpunt weghalen?" (scorers met aantal, `KiesDoelpuntWeg`), behalve als er maar één scorer is: dan meteen weg.
   - Veld met de opstelling en de keeper eronder. Tik op een speler: **Wissel** (met wisselspeler) of **Verplaatsen** (ruilen met veldspeler of wisselspeler). Keeper: alleen verplaatsen. Lege plek (gestippeld, "+"): tik om iemand erin te zetten.
   - Eén regel wisselspelers in beeld (2 naast elkaar), zonder kopje. Meer wissels staan onder de vouw.
   - **Onder de vouw** (alleen bereikbaar door te scrollen, bewust uit het zicht): extra wissels, knoppen **Alles resetten**, Undo, Nieuwe opstelling, Reset wissels, Score 0 – 0, en de **Timer** (Start/Pauze/Stop).
2. **Spelers**: aantal spelers (11, 9 of 6, met keeper) en opstelling kiezen; lijst van alle spelers met schakelaar "Doet mee / Doet niet mee", doelpunten per speler (⚽ n), speler toevoegen/verwijderen. Geen veld/bank-info hier.
3. **Voorkeur**: per speler een 1e en 2e voorkeurspositie (alleen posities van de huidige opstelling). Dubbele voorkeuren mogen.
4. **Historie**: bovenaan de kaart **Deze wedstrijd** (`src/components/DezeWedstrijd.tsx`): tegenstander/thuis-uit/datum (tik om te wijzigen), stand, scorers van deze wedstrijd en **Wedstrijd afsluiten** (alleen beheerders). Daaronder: balans (gespeeld/gewonnen/gelijk/verloren, doelpunten), topscorers over alle wedstrijden, lijst wedstrijden (tik: details, wijzigen — ook de stand: Wij + vraagt "Wie scoorde?" (wie toen meedeed, of Weet ik niet), Wij − vraagt welk doelpunt weg moet (per scorer), Zij gewoon −/+ — verwijderen), tegenstanders met resultaat (tik: hernoemen/verwijderen).

5. **Programma** (📅, `src/screens/Programma.tsx`): per datum een kaartje. Wedstrijd: datum, thuis/uit, tegenstander (clublijst, of "nog niet bekend"), verzamelen/aanvang, 🍎 fruit (speelster), 🚗 spelbegeleiding 1 en 2: per plek "Nog te bepalen" (`''`), "Niet nodig" (`'-'`) of "Ouder van <speelster>" (speler-id); op het kaartje bv. "niet nodig", "ouder Noor · nog 1 te bepalen" (`begeleidingTekst`). Per team de knop **Begeleiding** (beheerders): "Uitwedstrijd: geen begeleiding nodig" (standaard aan, de thuisclub regelt het) en "Thuiswedstrijd: geen begeleiding nodig" (standaard uit), bewaard in `teams.instellingen` (zonder team op het toestel); geldt voor nieuwe datums en bij thuis/uit omzetten, een gekozen ouder blijft staan. Opmerking. In het bewerkvenster tonen de keuzelijsten per speelster hoe vaak ze dit seizoen al fruit/begeleiding heeft (geweest + gepland, zonder de bewerkte datum), gesorteerd van minst naar meest. Geen wedstrijd: omschrijving, eventueel een periode (`tot`). Onder "Mijn kind" (met "Alleen mijn beurten") een rij met "⇄ Nog te spelen / ⇄ Geweest" (wisselt de lijst; standaard nog te spelen, eerstvolgende wedstrijd "Volgende"; geweest = grijzer, nieuwste eerst) en voor beheerders "Begeleiding" (standaard spelbegeleiding), daaronder "+ Datum toevoegen". **Mijn kind**: kies je kind(eren); kaartjes met een beurt van jouw kind krijgen een gele rand en "Jij: fruit/begeleiding", met filter "Alleen mijn beurten". Keuze staat bij een gewoon account op de server (`users.kinderen`, per team), bij meekijkers/zonder inloggen op het toestel. Beheerders: "+ Datum toevoegen"; elk kaartje is een gewoon vlak met onderin twee knoppen naast elkaar: **✏️ Wijzigen** (ook verwijderen) en, bij komende wedstrijden, **🏑 Op het veld zetten** (blauw bij de eerstvolgende wedstrijd met label "Volgende", grijs bij latere): datum, tegenstander en thuis/uit worden "Deze wedstrijd" (met `programmaId`, zodat Historie → Deze wedstrijd de verzamel-/aanvangstijd toont en het kaartje de groene regel "✅ Staat nu klaar op het Dashboard" krijgt) en de app springt naar het Dashboard. Kijkers zien geen knoppen. Staat er nog een wedstrijd open (stand ≠ 0-0 of timer gelopen), dan eerst een vraag; bevestigen = Alles resetten + klaarzetten. Gesynchroniseerd als soort `programma` (collectie `programma`).
6. **Instellingen** (⚙️, `src/screens/Instellingen.tsx`): alles rond inloggen, in kaarten. Niet ingelogd: Inloggen (+ wachtwoord vergeten) en "Nog geen account?" (uitnodiging vragen of team aanmelden). Ingelogd: Account (naam, e-mail, rol, Uitloggen), Werken met (teams met ✓, "Zonder team", sync-status, per beheerd team de knop Leden), en Nieuw team (superadmin) of Ander team aanmelden. Altijd onderaan: Weergave (Automatisch/Licht/Donker). Subschermen (Leden, Uitnodiging, Nieuw wachtwoord, Team aanmelden, Teamaanmelding) met een "‹ Terug"-balk. Links uit mails openen hier.

Tabbladen: iconen, alle zes even breed (60px); alleen het actieve tabblad toont zijn naam eronder (24px). Die naam loopt uit onder de lege plek van de buren (aan de randen uitgelijnd met de schermrand) en heeft `pointer-events: none`, zodat tikken op de buurknop blijft werken. Tabbalk ~75px hoog. Bij een sync-probleem staat ⚠ op het tandwiel. Het gekozen tabblad staat buiten de `HockeyProvider` (in `MetTeam`), zodat je na inloggen of van team wisselen op hetzelfde tabblad blijft, en in `sessionStorage` (`<opslag>_tabblad`), zodat je na verversen op hetzelfde tabblad blijft; een nieuw browsertabblad begint op het Dashboard.
Dashboard: alleen zonder account bovenaan de knop "👤 Inloggen", die naar Instellingen gaat.

**Niet ingelogd = voorbeeld** (`demo` in de `HockeyProvider`, `src/demo.ts`): alleen het Dashboard werkt echt, in een eigen opslag (`<opslag>_demo`, los van "Zonder team"). Spelers, Voorkeur, Programma en Historie tonen vaste voorbeeldgegevens (testnamen, verzonnen clubs, datums rond vandaag, 'mijn kind' Emma) en zijn niet te wijzigen (`magBeheren` false; `magBewerken` blijft voor het Dashboard). Bovenaan die tabbladen "👤 Inloggen" + "Dit is een voorbeeld". Ingelogd "Zonder team" werkt zoals altijd met de eigen gegevens op de telefoon.

### Regels
- **Wisselteller** gaat +1 bij de speler die **uit** het veld gaat (alleen bij Wissel, niet bij Verplaatsen). De invaller neemt de positie over.
- **Wisselspelers sorteren**: minste wissels eerst; bij gelijke stand komt wie het laatst uit het veld ging onderaan. Zelfde volgorde in de wissel-pop-up.
- **Kleuren in het veld** (alleen informatief, blokkeert niets), op volgorde van invallen (`inVolgorde`), niet op tijd: bij 11 en 9 spelers de laatste 2 invallers rood, 2 daarvoor oranje, de rest (ook de basis) groen; bij 6 spelers 1 rood, 1 oranje. Keeper geen kleur.
- **Nieuwe opstelling**: eerst eerlijk loten wie begint (iedereen gelijke kans op de bank), dan per basisspeler de 1e voorkeur, daarna de 2e (beide in gelote volgorde, bij dubbele keuze wint een willekeurige), rest willekeurig. Tellers blijven staan; `inVolgorde` terug naar 0.
- **Reset wissels**: alleen tellers — veldspelers 0, wisselspelers 1 (die staan al één keer "uit"). Opstelling en score blijven.
- **Alles resetten**: nieuwe opstelling + reset wissels + score 0-0 en scorers weg + timer 0:00 gestopt. Spelers, aanwezigheid, voorkeuren en gekozen opstelling blijven.
- **Afmelden** van een veldspeler: wisselspeler met de minste wissels neemt de plek over (teller ongewijzigd). Keeper afmelden laat het doel leeg. Aanmelden: naar een lege veldplek als die er is, anders de bank. Afgemelden doen niet mee in opstelling, wissels of loting.
- **Andere opstelling kiezen**: wie op een positie staat die ook in de nieuwe opstelling zit blijft staan; spelers van weggevallen posities schuiven naar vrije plekken; te veel → bank, te weinig → aanvullen met minste wissels. Tellers blijven.
- **Wedstrijd afsluiten**: tegenstander verplicht. Bewaart datum, club, thuis/uit, score, scorers (id + naam), wie meedeed (met wissels) en opstelling in `wedstrijden`; daarna hetzelfde als Alles resetten en de undo-geschiedenis wordt gewist (afsluiten is niet terug te draaien). Datum `null` = vandaag.
- **Clubs** worden automatisch onthouden zodra je er een kiest/typt en opslaat (pas bij Opslaan, niet bij Annuleren); keuzelijst laatst gebruikt bovenaan, dubbele namen (hoofdletterongevoelig) worden hergebruikt. Club verwijderen haalt hem alleen uit de keuzelijst; oude wedstrijden houden hun opgeslagen naam.
- **Undo** draait spelers, wissels, score en scorers terug (niet de timer).
- **Timer** bewaart starttijdstip + opgebouwde tijd, zodat hij klopt na verversen of een vergrendeld scherm. Stop vraagt bevestiging.
- **Trek omlaag om te verversen** (eigen implementatie, `Verversen.tsx`): nodig omdat html/body niet scrollen (alleen `.content`). Rond draaiend icoon, niet in pop-ups.
- Geen meldingen (toasts) na een bevestiging. Bevestigingsvragen alleen bij resets en timer-stop.

### Opstellingen
Posities (van voor naar achter): `LW` links voor, `CV` centraal voor, `RW` rechts voor, `LM` links midden, `LCM` links binnen, `CM` midden, `RCM` rechts binnen, `RM` rechts midden, `LBM` links achter, `LCA` links centraal, `CBM` centraal achter, `RCA` rechts centraal, `RBM` rechts achter, `K` keeper. Codes nooit in de UI tonen, alleen de Nederlandse labels (`POSITIE_LABEL`).

**In beeld altijd hockeytaal: van achter naar voor, zonder keeper** (`opstellingTekst`). Intern (opslag, server, `OPSTELLINGEN`) staan de namen van voor naar achter; die nooit hernoemen, anders verandert de betekenis van bewaarde gegevens.

| Spelvorm | In beeld (eerste = standaard) | Intern |
|---|---|---|
| 11 spelers (10 + keeper) | 3-4-3, 4-3-3 | 3-4-3, 3-3-4 |
| 9 spelers (8 + keeper) | 3-3-2, 2-3-3, 3-2-3 | 2-3-3, 3-3-2, 3-2-3 |
| 6 spelers (5 + keeper) | 2-1-2, 1-2-2, 2-2-1 | 2-1-2, 2-2-1, 1-2-2 |

Een onbekende opgeslagen opstelling wordt vervangen (`leesOpstelling`: het vervallen 4-4-2 (intern 2-4-4) → 3-4-3, oude test-namen 3-3-3-1/4-3-3 → 3-4-3/3-3-4); veldspelers op een plek die niet in de opstelling zit schuiven vanzelf door (`pasOpstellingAan`).

Gedefinieerd in `OPSTELLINGEN` / `OPSTELLINGEN_PER_SPELVORM` in `src/types.ts`.

### Team
**Spelersnamen: alleen de voornaam, geen tweede veld.** Namen zijn uniek per team (hoofdletters/spaties tellen niet mee, `naamBezet` in `src/opstelling.ts`); bij twee dezelfde voornamen maakt de beheerder de naam zelf uniek (bv. "Emma B."). De app meldt dit bij toevoegen; de server heeft een unieke index (`spelers`: team + naam, NOCASE) als vangrail.

**Geen namen van echte speelsters in de repo** (die is openbaar); de echte spelers staan alleen op de server. Niet ingelogd en zonder team begint de app met de namen van het testteam (`DEMO_SPELERS` in `src/demo.ts`: 11 spelers, keeper Saar, twee wissels) in spelvorm 11 (3-4-3). Telefoons die zonder team nog de oude startlijst hadden, krijgen die namen één keer vervangen (`vervangOudeNamen`, herkend aan id 1–11 + hash van de naam, ook in de historie; daarna vlag `namen_vervangen`), zodat namen daarna gewoon zelf aan te passen zijn.

### Accounts (tabblad Instellingen, `src/screens/Instellingen.tsx`)
- Inloggen met e-mail + wachtwoord; **Wachtwoord vergeten** mailt een link `#wachtwoord=<token>` naar de app. Vrij aanmelden kan niet: alleen via een uitnodiging (`#uitnodiging=<token>`, 7 dagen geldig, eenmalig).
- Rollen per team: **beheerder** (alles in het eigen team: bijhouden, spelers/clubs/wedstrijden ook verwijderen, leden uitnodigen, rollen wijzigen, ook andere beheerders aanwijzen en weghalen) en **kijker** (alleen meekijken). Er is geen aparte bewerker-rol meer (samengevoegd met beheerder). **Superadmin** (alleen de eigenaar; vlag `superadmin` op de gebruiker, alleen via het PocketBase-beheerscherm) maakt en verwijdert teams en mag in elk team alles.
- De app leest links uit de mail uit `location.hash` (`#uitnodiging=`, `#wachtwoord=`, `#aanmelding=`) en haalt het `#` daarna weg.
- **Nieuw team aanmelden** (knop op het inlogscherm, en "Nog een team aanmelden" voor ingelogde niet-superadmins): teamnaam, naam, e-mail, bericht → `POST /api/hockey/aanmelding` (max 5 per uur per bezoeker). Alle superadmins krijgen een mail met een link `#aanmelding=<token>` die niet verloopt maar maar één keer te gebruiken is; openen verandert niets, pas de knop Goedkeuren/Afwijzen. Goedkeuren maakt het team (naam nog aan te passen) en mailt de aanvrager een uitnodiging als beheerder; afwijzen mailt een korte afwijzing.
- **Werken met**: in Instellingen kies je het actieve team (✓) of "Zonder team". Bij precies één team gaat dat vanzelf. Per team een eigen opslag (`HockeyProvider key={teamId}`). De eerste keer in een leeg team vraagt de app of wat op de telefoon staat mee moet (met nieuwe id's, `nieuweIds`).
- **Synchroniseren** (`src/sync.ts` + `src/context/useTeamSync.ts`): offline eerst. Per record drie standen: lokaal, basis (laatste serverstand, bewaard) en server. Lokaal gewijzigd → versturen; anders serverstand overnemen; door de server geweigerd (bv. kijker) → serverstand terug. **Verwijderen alleen expliciet**: `deleteSpeler`/`verwijderClub`/`verwijderWedstrijd` zetten het id in `verwijderd` (bewaard per team); alleen die id's worden op de server gewist. Lokaal ontbrekend is nooit een reden om te wissen (dat wiste eens nieuwe wedstrijden via een toestel met een verouderde lijst) — dan komt de serverstand terug. Na elke ronde geldt het samengevoegde resultaat meteen als lokaal (`recordsRef`), niet pas na de render. Triggers: lokale wijziging (0,8 s), realtime (subscribe), online/terug naar de app, elke 60 s. Id's maakt de app zelf (`pbId`, 15 tekens a-z0-9).
- **Live wedstrijd** (`src/live.ts` + `src/context/useLiveStand.ts`): per team één record in `standen` (id = team-id) met de hele stand als JSON, `versie` en `bron` (toestel-id). Laatste schrijver wint. Eigen wijziging → na 0,25 s versturen; ontvangen stand alleen toepassen als er geen onverzonden eigen wijziging is. Een toestel dat nieuw meedoet verstuurt pas na de eerste keer ophalen en neemt dan de serverstand over. Nieuwe spelers uit de spelerslijst krijgen hun plek uit de bewaarde serverstand. Na ontvangen wordt de undo-geschiedenis gewist. Getest met drie nagebootste toestellen (jsdom + echte HockeyProvider) tegen een test-server.
- **Aanmeldlink voor ouders** (knop in Instellingen bij het actieve team, alleen beheerders; `DeelKijklink soort="aanvraag"`): `#aanvraag=<teamId>.<token>` (token in `teams.aanvraaglink`, vernieuwen = oude link ongeldig). Ouder vult in: eigen voornaam, voornaam kind (kiezen uit de spelers of intypen), e-mail → `toegangsaanvragen` (max 5 per uur per bezoeker, dubbel = geen tweede mail). Alle beheerders van het team (zonder beheerders: superadmins) krijgen een mail met `#toegang=<token>`: Toelaten als kijker/beheerder of Afwijzen. Open aanvragen ook in Instellingen → Leden (Toelaten = kijker). Toelaten maakt de gewone uitnodiging met naam en kind; bij aannemen wordt het kind meteen 'mijn kind' (`users.kinderen`). Afwijzen mailt de ouder.
- **Meekijklink** (`src/components/DeelKijklink.tsx`, knop "🔗 Meekijklink delen" alleen in Instellingen bij het actieve team; voor beheerders én kijkers): per team een verborgen gast-account (`gast = true`, e-mail `kijk-<teamId>@meekijken.invalid`) dat kijker is. Het wachtwoord staat in `teams.kijklink` (alleen leden lezen het) en in de link `#kijk=<teamId>.<token>`. Openen = inloggen als die gast en het team kiezen (zelf al lid: gewoon het team openen; ingelogd als iemand anders: eerst vragen). Maken/vernieuwen via `POST /api/hockey/kijklink/{team}`: elk lid krijgt de bestaande link (of een nieuwe als er geen werkende is), alleen beheerders/superadmin kunnen vernieuwen (oude link en sessies vervallen). Een gast kan zichzelf niet wijzigen of verwijderen. Delen via `navigator.share`, anders kopiëren, anders de link tonen. In Leden staat de gast als "🔗 Meekijklink"; eruit halen zet de link uit.
- **Kijkers** (`magBewerken` false): alleen meekijken; op het dashboard doen veld, score, timer en knoppen niets, en onder de vouw staat "Je kijkt live mee". Verder: geen speler toevoegen/verwijderen, geen voorkeuren, geen wedstrijd afsluiten of historie wijzigen. Status staat onder "Werken met" en als ⚠ op het tandwiel.

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
- `src/foutmelder.ts` + `src/components/Foutvanger.tsx`: JS-fouten, mislukte beloftes, crashes (met "Opnieuw laden"-scherm) en herladen door oude cache gaan naar `POST /api/hockey/fout` (max 5 per keer laden, dubbel één keer, 30 per uur per bezoeker, laatste 1000 bewaard; adres zonder # en ?). Lezen: superadmin, of Claude alleen-lezen via sqlite op `server/pb_data/data.db` (tabel `foutmeldingen`).
- `src/statistiek.ts`: GoatCounter (`juuul.goatcounter.com`); `tel('knop')` telt klikken, alleen in de gepubliceerde build, op test met voorvoegsel `test/`.

### Datamodel (`src/types.ts`)
```typescript
interface Player {
  id: string; naam: string; positie: Position;
  inVeld: boolean;      // staat in het veld (anders bank)
  meedoen: boolean;     // aanwezig vandaag
  inVolgorde?: number;  // volgnummer van invallen (voor de kleuren)
  wisselCount: number; isKeeper: boolean;
}
interface Wissel { id: string; tijdstip: Date; inSpeler: string; uitSpeler: string; positie: Position }
```

### Opslag (localStorage)
Sleutels `hockey_<naam>` op live en `hockey_test_<naam>` op test (zelfde domein, dus gescheiden); met een actief team `hockey[_test]_t_<teamId>_<naam>` (plus `basis` en `overnemen_gevraagd`). Los daarvan: `auth`, `teams`, `actief_team`. Gegevens: `spelers`, `wisselingen`, `vaste_posities` (per speler `[1e, 2e]`), `score`, `doelpunten` (scorer-id's of null), `opstelling`, `timer`, `clubs`, `wedstrijd` (lopende: datum/clubId/thuis), `wedstrijden` (afgesloten, zie `GespeeldeWedstrijd`). Bij nieuwe velden altijd migreren vanuit oude opgeslagen data (zie bestaande voorbeelden in de context). Opslag is per toestel/browser: andere telefoons zien andere data.

## Server (PocketBase)
- Map `server/`: `Dockerfile` + `docker-compose.yml` (container `hockey-pocketbase`, alleen `127.0.0.1:8090`), `pb_migrations/` (collecties + rechten), `pb_hooks/` (uitnodigingen mailen/aannemen). Data in `server/pb_data/` (niet in git).
- CORS (`--origins` in de Dockerfile) en `TOEGESTAAN` (hooks) kennen zowel hockey.juliaan.eu als het oude juliaan.eu/hockey.
- Openbaar alleen `/api` via **Tailscale Funnel** (adres in `src/server.ts`, overschrijfbaar met `VITE_SERVER`). Beheerscherm `/_/` alleen via tailnet (poort 8443) of een SSH-tunnel naar `127.0.0.1:8090`.
- Mail via Gmail SMTP met een app-wachtwoord; ingesteld in het beheerscherm, niet in git.
- **De repo is openbaar**: geen e-mailadressen, wachtwoorden, tokens of andere persoonlijke gegevens committen.
- **Rechten worden op de server afgedwongen** (collection rules). In PocketBase 0.40: relaties vergelijken met `veld.id ?= …` (niet `veld ?= …`), en elke regel begint met `@request.auth.id != ""` (anders telt een lege relatie als match voor bezoekers). Twee keer dezelfde multi-relatie via één `@collection`-alias vergelijkt binnen dezelfde rij; gebruik back-relaties (`teams_via_beheerders.beheerders.id ?= …`).
- Migraties en hooks zitten **in het image** (niet gemount): de echte server verandert pas na `cd server && docker compose up -d --build`, en dat doet de gebruiker. (Eerder waren ze gemount; PocketBase herlaadde toen vanzelf en voerde een halve migratie uit.)
- Een migratie die al op de server gedraaid heeft **nooit aanpassen**: altijd een nieuwe migratie toevoegen.
- Hooks altijd eerst `node --check server/pb_hooks/*.js` (een syntaxfout laat PocketBase alle hooks overslaan).
- Wijzigingen eerst testen op een losse container met eigen datamap in de scratchpad (poort 8099, nep-SMTP, migraties/hooks daar wél gemount), nooit op de echte data. Voor problemen met echte data: een kopie maken met sqlite `backup()` (alleen-lezen bron) en daarop testen.
- Test en live gebruiken dezelfde server (zelfde accounts en teams). `appURL` (voor de wachtwoordlinks) staat op https://hockey.juliaan.eu/; uitnodigingen en aanmeldingen gaan terug naar de app waar ze vandaan kwamen (`terug`, alleen adressen uit `TOEGESTAAN` in `pb_hooks/hockey.js`).
- Echte bezoekers-IP via `X-Forwarded-For` (Tailscale zet die), zodat de limieten per bezoeker gelden. Limieten staan aan (PocketBase-standaard + aanmelding).

## Deploy
- GitHub Actions (`.github/workflows/deploy.yml`) bouwt bij elke push naar `main` of `test` **beide** branches en publiceert ze samen als één Pages-site: `main` in de root, `test` in `/test/` (test met `vite build --mode test`).
- Asset-paden zijn relatief (`base: './'`), dus de build werkt op elk pad/domein.
- Eigen adres: GitHub Pages van deze repo heeft custom domain **hockey.juliaan.eu** (CNAME `hockey` → `juuul.github.io` bij Vimexx, https afgedwongen). Het domein `juliaan.eu` zelf hoort bij de repo `juuul/juuul.github.io` (startpagina, lokaal in `/home/metime/projects/juuul.github.io`).
- DNS bij zxcs/Vimexx (A + AAAA naar GitHub Pages). De lokale resolver op deze machine cachet soms nog een oud parkeeradres; controleer live dan met `curl --resolve hockey.juliaan.eu:443:185.199.108.153 ...`.
- GitHub Pages cachet pagina's tot 10 minuten; de gebruiker ververst door de pagina omlaag te trekken.
- Bij elke publicatie verdwijnen de oude `assets/index-*.js/css`. Een telefoon met de oude `index.html` in de cache kreeg daardoor een leeg scherm; het inline script in `index.html` laadt dan één keer opnieuw met `?v=…` (buiten de cache), `main.tsx` ruimt dat weer op. Alleen reageren op eigen `/assets/`-bestanden: een geblokkeerde GoatCounter gaf eerst een eindeloze herlaad-lus.
