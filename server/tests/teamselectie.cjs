// Headless Chrome met fictieve API-antwoorden; geen echte aanvragen of mails.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const appUrl = process.env.TEST_URL || 'http://127.0.0.1:5187/'

;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844 })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    let aanvraag
    let nieuweGroep
    let enkeleGroep = false
    let toonExtraTeams = false
    let clubStoringen = 0
    const clubs = [{ id: 'club1', bronId: 'SCHC123', naam: 'SCHC', plaats: 'Bilthoven' }]
    const teams = [1, 2].map(n => ({ id: `team${n}`, bronId: String(n), naam: `SCHC MO11-${n}`, seizoen: '2026-2027', geslacht: 'Meisjes', leeftijd: 'O11', categorie: 'Jeugd', spelvorm: 'Veld', klasse: n === 1 ? '5e klasse' : '', gecontroleerd: '2026-10-15T12:00:00Z' }))
    const omgevingen = [{ id: 'groep1', naam: 'MO11-1 ouders' }, { id: 'groep2', naam: 'MO11-1 begeleiding' }]
    await page.setRequestInterception(true)
    page.on('request', req => {
      const url = new URL(req.url())
      if (url.pathname.includes('/api/')) {
        let body = {}
        const lijst = items => ({ items, page: 1, perPage: 1000, totalPages: 1, totalItems: items.length })
        if (url.pathname.includes('catalogus_clubs/records')) {
          if (req.method() === 'GET' && clubStoringen > 0) {
            clubStoringen--
            return req.abort('connectionfailed')
          }
          body = lijst(clubs)
        }
        else if (url.pathname.includes('catalogus_teams/records')) body = lijst(toonExtraTeams ? [...teams, { ...teams[0], id: 'team3', naam: 'SCHC MO12-1', leeftijd: 'O12', spelvorm: 'Zaal' }] : teams)
        else if (url.pathname.includes('catalogus_wedstrijden/records')) body = lijst([])
        else if (url.pathname.endsWith('/team1/omgevingen')) body = enkeleGroep ? omgevingen.slice(0, 1) : omgevingen
        else if (url.pathname.endsWith('/team2/omgevingen')) body = []
        else if (url.pathname.endsWith('/groep2/aanvraag') && req.method() === 'POST') {
          aanvraag = JSON.parse(req.postData())
          body = { ok: true }
        }
        else if (url.pathname.endsWith('/hockey/aanmelding') && req.method() === 'POST') {
          nieuweGroep = JSON.parse(req.postData())
          body = { ok: true }
        }
        return req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) })
      }
      if (url.hostname !== new URL(appUrl).hostname) return req.abort()
      return req.continue()
    })
    const klik = async tekst => {
      const gelukt = await page.evaluate(tekst => {
        const knop = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === tekst)
        if (!knop) return false
        knop.click()
        return true
      }, tekst)
      assert.ok(gelukt, `Knop ontbreekt: ${tekst}`)
    }
    const kiesTeam = async nummer => {
      await page.evaluate(nummer => [...document.querySelectorAll('.teamselectie-resultaat')].find(b => b.querySelector('strong')?.textContent === `SCHC MO11-${nummer}`).click(), nummer)
      await page.waitForSelector('[aria-current="step"]')
      await page.waitForFunction(() => document.querySelector('[aria-current="step"]').textContent.includes('Groep'))
    }
    const wachtOpClubs = () => page.waitForFunction(() => [...document.querySelectorAll('.teamselectie-resultaat strong')].some(o => o.textContent === 'SCHC'))
    const kiesClub = async () => {
      await wachtOpClubs()
      await page.evaluate(() => [...document.querySelectorAll('.teamselectie-resultaat')].find(b => b.querySelector('strong').textContent === 'SCHC').click())
    }
    const openZoeker = async (actie = 'Aansluiten bij een team') => {
      await page.goto(appUrl, { waitUntil: 'networkidle0' })
      await page.click('button[aria-label="Instellingen"]')
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.instellingen-kaart')].find(k => k.querySelector('h2')?.textContent === 'Je team').querySelectorAll('p').length), 0)
      if (process.env.PREVIEW_PATH) {
        const kaart = await page.evaluateHandle(() => [...document.querySelectorAll('.instellingen-kaart')].find(k => k.querySelector('h2')?.textContent === 'Je team'))
        await kaart.asElement().screenshot({ path: process.env.PREVIEW_PATH })
      }
      await klik(actie)
      await page.waitForSelector('input[type="search"]')
    }
    const begin = async () => {
      await openZoeker()
      await page.type('input[type="search"]', 'sc')
      await wachtOpClubs()
      assert.equal(await page.$('select'), null)
      if (process.env.SCREEN_PREVIEW_PATH) {
        await page.evaluate(() => { document.querySelector('.content').scrollTop = 0 })
        await page.screenshot({ path: process.env.SCREEN_PREVIEW_PATH })
      }
      await kiesClub()
      await page.waitForFunction(() => [...document.querySelectorAll('.teamselectie-resultaat strong')].some(o => o.textContent === 'SCHC MO11-2'))
      const labels = await page.$$eval('label', nodes => nodes.map(n => n.firstChild?.textContent.trim()))
      assert.ok(!labels.includes('Klasse') && !labels.includes('Categorie'))
      assert.equal(await page.$('input[name="groepskeuze"]'), null)
      assert.ok(await page.evaluate(() => document.body.textContent.includes('Welk team zoek je?')))
      assert.equal(await page.$('input[placeholder="Clubnaam of plaats"]'), null)
      assert.equal(await page.$('button[type="submit"]'), null)
      if (process.env.TEAM_PREVIEW_PATH) await page.screenshot({ path: process.env.TEAM_PREVIEW_PATH })
    }
    await begin()
    await page.type('input[placeholder="Zoek een team"]', 'mo11-1')
    assert.equal(await page.$$eval('.teamselectie-resultaat', nodes => nodes.length), 1)
    await page.keyboard.press('Enter')
    assert.equal(await page.$('input[autoComplete="name"]'), null)
    await kiesTeam(1)
    await page.waitForSelector('input[name="bestaande-groep"][value="groep2"]')
    assert.equal(await page.$('input[type="search"]'), null)
    await page.click('input[name="bestaande-groep"][value="groep2"]')
    await page.type('input[autoComplete="name"]', 'Testouder')
    await page.type('input[type="email"]', 'test@example.invalid')
    if (process.env.GROUP_PREVIEW_PATH) await page.screenshot({ path: process.env.GROUP_PREVIEW_PATH })
    await klik('Toegang aanvragen')
    await page.waitForFunction(() => document.body.textContent.includes('Aanvraag verstuurd.'))
    assert.equal(aanvraag.email, 'test@example.invalid')
    await page.click('.instellingen-terug')
    await page.waitForFunction(() => document.body.textContent.includes('Je team'))

    await begin()
    await kiesTeam(2)
    await page.waitForFunction(() => document.body.textContent.includes('Geen openbare groep gevonden'))
    assert.equal(await page.$$eval('button[type="submit"]', nodes => nodes.length), 0)
    await klik('Nieuw team starten')
    await page.waitForSelector('input[placeholder="Bijvoorbeeld begeleiding"]')
    assert.ok(await page.evaluate(() => document.body.textContent.includes('Je wordt beheerder van deze groep.')))
    await page.type('input[autoComplete="name"]', 'Testouder')
    await page.type('input[type="email"]', 'test@example.invalid')
    await page.type('input[placeholder="Bijvoorbeeld begeleiding"]', 'Nieuwe testgroep')
    await klik('Eigen groep maken')
    await page.waitForFunction(() => document.body.textContent.includes('Je krijgt een uitnodiging op'))
    assert.equal(nieuweGroep.officieelTeam, 'team2')
    assert.equal(nieuweGroep.omgevingNaam, 'Nieuwe testgroep')

    enkeleGroep = true
    await begin()
    await kiesTeam(1)
    await page.waitForSelector('input[name="bestaande-groep"][value="groep1"]')
    assert.equal(await page.$eval('input[name="bestaande-groep"]', el => el.checked), true)
    // Terug en Wijzigen bewaren zoekopdracht/invoer; een ander team wist de groepskeuze.
    await page.type('input[autoComplete="name"]', 'Bewaarde naam')
    await page.click('.instellingen-terug')
    await page.waitForSelector('input[placeholder="Zoek een team"]')
    await page.type('input[placeholder="Zoek een team"]', 'mo11')
    await kiesTeam(1)
    assert.equal(await page.$eval('input[autoComplete="name"]', el => el.value), 'Bewaarde naam')
    await klik('Wijzigen')
    await page.waitForSelector('input[placeholder="Zoek een team"]')
    assert.equal(await page.$eval('input[type="search"]', el => el.value), 'mo11')
    await kiesTeam(2)
    await page.waitForFunction(() => document.body.textContent.includes('Geen openbare groep gevonden'))
    assert.equal(await page.$('input[name="bestaande-groep"]'), null)
    await page.goBack()
    await page.waitForSelector('input[placeholder="Zoek een team"]')
    await page.goBack()
    await page.waitForSelector('input[placeholder="Clubnaam of plaats"]')
    assert.equal(await page.$eval('input[type="search"]', el => el.value), 'sc')

    await openZoeker('Nieuw team starten')
    assert.equal(await page.$('input[name="groepskeuze"]'), null)
    await klik('Aansluiten bij een team')
    assert.equal(await page.$('button[type="submit"]'), null)

    // Teamfilters zijn optioneel en combineren met de vrije teamzoeker.
    toonExtraTeams = true
    await begin()
    assert.equal(await page.$eval('.teamselectie-filters', el => el.open), false)
    await page.click('.teamselectie-filters summary')
    const veldFilter = await page.evaluateHandle(() => [...document.querySelectorAll('.teamselectie-filters label')].find(l => l.firstChild.textContent.trim() === 'Veld of zaal').querySelector('select'))
    await veldFilter.asElement().select('Zaal')
    await page.waitForFunction(() => document.querySelectorAll('.teamselectie-resultaat').length === 1)
    assert.equal(await page.$eval('.teamselectie-resultaat strong', el => el.textContent), 'SCHC MO12-1')
    await page.type('input[placeholder="Zoek een team"]', 'mo11')
    await page.waitForFunction(() => document.body.textContent.includes('Geen teams gevonden.'))
    toonExtraTeams = false

    // Eerste keer zonder cache: een laadfout is nooit een leeg zoekresultaat.
    await page.evaluate(() => localStorage.removeItem('hockey_test_catalogus_clubs'))
    clubStoringen = 1
    await openZoeker()
    await page.type('input[type="search"]', 'Sc')
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Geen clubs gevonden')), false)
    await wachtOpClubs()

    // Bij aanhoudende uitval blijft de eerder geladen openbare lijst bruikbaar.
    clubStoringen = 3
    await openZoeker()
    await page.type('input[type="search"]', 'Sc')
    await page.waitForFunction(() => document.body.textContent.includes('Clubs laden lukt niet.'))
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Geen clubs gevonden')), false)
    await wachtOpClubs()
    await klik('Opnieuw proberen')
    await page.waitForFunction(() => !document.body.textContent.includes('Clubs laden lukt niet.') && !document.body.textContent.includes('Clublijst bijwerken'))

    // Ook zonder cache is herstel mogelijk zodra het toestel weer online komt.
    await page.evaluate(() => localStorage.removeItem('hockey_test_catalogus_clubs'))
    clubStoringen = 3
    await openZoeker()
    await page.waitForFunction(() => document.body.textContent.includes('Clubs laden lukt niet.'))
    assert.equal(await page.$('select'), null)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.type('input[type="search"]', 'Sc')
    await wachtOpClubs()
    await page.click('input[type="search"]', { clickCount: 3 })
    await page.type('input[type="search"]', 'zzzzzz')
    await page.waitForFunction(() => document.body.textContent.includes('Geen clubs gevonden'))
    // Smalle telefoons houden de volledige titel en inhoud binnen het scherm.
    await page.setViewport({ width: 320, height: 640 })
    await page.waitForFunction(() => document.querySelector('.instellingen-kop-titel').scrollWidth <= document.querySelector('.instellingen-kop-titel').clientWidth)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.click('input[type="search"]', { clickCount: 3 })
    await page.type('input[type="search"]', 'sc')
    await kiesClub()
    await page.waitForSelector('input[placeholder="Zoek een team"]')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await kiesTeam(1)
    await page.waitForSelector('input[autoComplete="name"]')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const donkereTekst = await page.$eval('.teamselectie-vraag', el => getComputedStyle(el).color)
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await page.waitForFunction(donker => getComputedStyle(document.querySelector('.teamselectie-vraag')).color !== donker, {}, donkereTekst)
    if (process.env.LIGHT_PREVIEW_PATH) await page.screenshot({ path: process.env.LIGHT_PREVIEW_PATH })
    console.log('TEAMSELECTIE_OK: één stap per scherm, club/team zoeken, optionele filters, Enter verstuurt niets, app-/browserterug bewaart invoer, teamwissel wist groep, aanvragen en nieuwe groep, smalle schermen en licht/donker.')
    console.log('CLUBVERBINDING_OK: automatische herpoging, geen foutieve lege resultaten, openbare cache, handmatig opnieuw laden en herstel bij online.')
  } finally {
    await browser.close()
  }
})().catch(err => { console.error(err); process.exit(1) })
