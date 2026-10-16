// Headless Chrome met fictieve API-antwoorden; geen echte aanvragen of mails.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')

;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844 })
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    let aanvraag
    let nieuweGroep
    let enkeleGroep = false
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
        else if (url.pathname.includes('catalogus_teams/records')) body = lijst(teams)
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
      if (url.hostname !== '127.0.0.1') return req.abort()
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
    const kies = async (label, waarde) => {
      const element = await page.evaluateHandle(label => [...document.querySelectorAll('label')].find(l => l.firstChild?.textContent.trim() === label)?.querySelector('select'), label)
      await element.asElement().select(waarde)
    }
    const openZoeker = async (actie = 'Aansluiten bij een team') => {
      await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5187/', { waitUntil: 'networkidle0' })
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
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('select option')].some(o => o.textContent.includes('SCHC'))))
      await kies('Club', 'club1')
      await page.waitForFunction(() => [...document.querySelectorAll('option')].some(o => o.value === 'team2'))
      const labels = await page.$$eval('label', nodes => nodes.map(n => n.firstChild?.textContent.trim()))
      assert.ok(!labels.includes('Klasse') && !labels.includes('Categorie'))
      assert.equal(await page.$('input[name="groepskeuze"]'), null)
      assert.ok(await page.evaluate(() => document.body.textContent.includes('De teambeheerder keurt je aanvraag goed.')))
    }
    await begin()
    await kies('Officieel team', 'team1')
    await page.waitForSelector('input[name="bestaande-groep"][value="groep2"]')
    await page.click('input[name="bestaande-groep"][value="groep2"]')
    await page.type('input[autoComplete="name"]', 'Testouder')
    await page.type('input[type="email"]', 'test@example.invalid')
    await klik('Toegang aanvragen bij deze groep')
    await page.waitForFunction(() => document.body.textContent.includes('Je aanvraag staat klaar voor de beheerder'))
    assert.equal(aanvraag.email, 'test@example.invalid')

    await begin()
    await kies('Officieel team', 'team2')
    await page.waitForFunction(() => document.body.textContent.includes('Geen openbare groep gevonden'))
    assert.equal(await page.$$eval('button[type="submit"]', nodes => nodes.length), 0)
    await klik('Nieuw team starten')
    await page.waitForSelector('input[placeholder="Bijvoorbeeld begeleiding"]')
    assert.ok(await page.evaluate(() => document.body.textContent.includes('Je wordt beheerder van je eigen teamgroep.')))
    await page.type('input[autoComplete="name"]', 'Testouder')
    await page.type('input[type="email"]', 'test@example.invalid')
    await page.type('input[placeholder="Bijvoorbeeld begeleiding"]', 'Nieuwe testgroep')
    await klik('Eigen groep maken')
    await page.waitForFunction(() => document.body.textContent.includes('Je krijgt een uitnodiging op'))
    assert.equal(nieuweGroep.officieelTeam, 'team2')
    assert.equal(nieuweGroep.omgevingNaam, 'Nieuwe testgroep')

    enkeleGroep = true
    await begin()
    await kies('Officieel team', 'team1')
    await page.waitForSelector('input[name="bestaande-groep"][value="groep1"]')
    assert.equal(await page.$eval('input[name="bestaande-groep"]', el => el.checked), true)

    await openZoeker('Nieuw team starten')
    assert.ok(await page.evaluate(() => document.body.textContent.includes('Je wordt beheerder van je eigen teamgroep.')))
    assert.equal(await page.$('input[name="groepskeuze"]'), null)
    await klik('Aansluiten bij een team')
    assert.ok(await page.evaluate(() => document.body.textContent.includes('De teambeheerder keurt je aanvraag goed.')))

    // Eerste keer zonder cache: een laadfout is nooit een leeg zoekresultaat.
    await page.evaluate(() => localStorage.removeItem('hockey_test_catalogus_clubs'))
    clubStoringen = 1
    await openZoeker()
    await page.type('input[type="search"]', 'Sc')
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Geen clubs gevonden')), false)
    await page.waitForFunction(() => [...document.querySelectorAll('select option')].some(o => o.textContent.includes('SCHC')))

    // Bij aanhoudende uitval blijft de eerder geladen openbare lijst bruikbaar.
    clubStoringen = 3
    await openZoeker()
    await page.type('input[type="search"]', 'Sc')
    await page.waitForFunction(() => document.body.textContent.includes('De clublijst kon niet worden opgehaald'))
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Geen clubs gevonden')), false)
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('select option')].some(o => o.textContent.includes('SCHC'))))
    await klik('Clubs opnieuw ophalen')
    await page.waitForFunction(() => !document.body.textContent.includes('De clublijst kon niet worden opgehaald') && !document.body.textContent.includes('Clublijst bijwerken'))

    // Ook zonder cache is herstel mogelijk zodra het toestel weer online komt.
    await page.evaluate(() => localStorage.removeItem('hockey_test_catalogus_clubs'))
    clubStoringen = 3
    await openZoeker()
    await page.waitForFunction(() => document.body.textContent.includes('De clublijst kon niet worden opgehaald'))
    assert.equal(await page.$eval('select', el => el.disabled), true)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForFunction(() => [...document.querySelectorAll('select option')].some(o => o.textContent.includes('SCHC')))
    await page.type('input[type="search"]', 'zzzzzz')
    await page.waitForFunction(() => document.body.textContent.includes('Geen clubs gevonden'))
    console.log('TEAMSELECTIE_OK: sc vindt SCHC, beide MO11-teams zichtbaar, geen klasse/categorie, groep kiezen en toegang aanvragen, lege lijst, nieuwe groep en automatische keuze bij één groep.')
    console.log('CLUBVERBINDING_OK: automatische herpoging, geen foutieve lege resultaten, openbare cache, handmatig opnieuw laden en herstel bij online.')
  } finally {
    await browser.close()
  }
})().catch(err => { console.error(err); process.exit(1) })
