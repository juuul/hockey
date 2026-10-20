// Volledige browserflow met fictieve accounts/API: geen echte data, mails of wijzigingen.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const appUrl = process.env.TEST_URL || 'http://127.0.0.1:5187/'
const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 4000000000 })).toString('base64url')}.test`

;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  let page
  let syncFout = false
  let reisFout = false
  let instellingenFout = false
  let wijzigingen = []
  const fouten = []
  try {
    const open = async ({ kijker = false, superadmin = false, aanvragen = false } = {}) => {
      if (page) await page.close()
      page = await browser.newPage()
      page.on('pageerror', e => fouten.push(e.message))
      await page.setViewport({ width: 390, height: 844 })
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
      const gebruiker = { id: 'oudertest1234567', email: 'ouder@example.invalid', name: 'Testouder', superadmin }
      const teams = [1, 2].map(n => ({ id: `testteam000000${n}`, naam: `Testteam ${n}`, beheerders: kijker ? [] : [gebruiker.id], kijkers: kijker ? [gebruiker.id] : [], officieelTeam: `officieel${n}`, vindbaar: true }))
      const reistijden = {}
      await page.evaluateOnNewDocument(({ token, gebruiker, teams }) => {
        localStorage.clear()
        localStorage.setItem('hockey_test_backend', 'apart-v1')
        localStorage.setItem('hockey_test_auth', JSON.stringify({ token, record: gebruiker }))
        localStorage.setItem('hockey_test_teams', JSON.stringify(teams))
        localStorage.setItem('hockey_test_actief_team', JSON.stringify(teams[0].id))
        teams.forEach(t => localStorage.setItem(`hockey_test_t_${t.id}_overnemen_gevraagd`, 'true'))
        sessionStorage.setItem('hockey_test_tabblad', 'instellingen')
        window.gedeeldeLinks = []
        Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.gedeeldeLinks.push(data) } })
        // Simuleer een gezonde realtimeverbinding, zonder een echte server te benaderen.
        window.EventSource = class extends EventTarget {
          readyState = 1
          constructor() {
            super()
            setTimeout(() => this.dispatchEvent(new MessageEvent('PB_CONNECT', { lastEventId: 'testclient', data: '{}' })), 0)
          }
          close() { this.readyState = 2 }
        }
      }, { token, gebruiker, teams })
      await page.setRequestInterception(true)
      page.on('request', req => {
        const url = new URL(req.url())
        if (!url.pathname.includes('/api/')) return url.hostname === new URL(appUrl).hostname ? req.continue() : req.abort()
        const lijst = items => ({ page: 1, perPage: 1000, totalPages: 1, totalItems: items.length, items })
        let body = lijst([])
        if (url.pathname.endsWith('/auth-refresh')) body = { token, record: gebruiker }
        else if (url.pathname.includes('/teams/records')) {
          if (req.method() === 'PATCH') {
            if (instellingenFout) return req.respond({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ message: 'Instellingen niet opgeslagen' }) })
            const data = JSON.parse(req.postData()); wijzigingen.push({ pad: url.pathname, data })
            const team = teams.find(t => url.pathname.endsWith(t.id)); Object.assign(team, data); body = team
          } else body = lijst(teams)
        }
        else if (url.pathname.includes('/spelers/records') && syncFout) return req.abort('connectionfailed')
        else if (url.pathname.includes('/standen/records/')) body = { id: teams[0].id, versie: 0 }
        else if (url.pathname.includes('/toegangsaanvragen/records') && aanvragen) body = lijst([{ id: 'aanvraagtest', naam: 'Testaanvrager', email: 'aanvrager@example.invalid', team: teams[0].id }])
        else if (url.pathname.includes('/verzamelinstellingen')) {
          if (req.method() === 'GET' && reisFout) return req.respond({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ message: 'Teststoring' }) })
          const globaal = { voorbereidingMinuten: 30, bufferMinuten: 5 }
          if (req.method() === 'POST') {
            const data = JSON.parse(req.postData())
            wijzigingen.push({ pad: url.pathname, data })
            reistijden[url.pathname] = data
          }
          const eigen = reistijden[url.pathname] || {}
          body = url.pathname.includes('/team/') ? { globaal, eigen, effectief: { voorbereidingMinuten: eigen.voorbereidingMinuten ?? 30, bufferMinuten: eigen.bufferMinuten ?? 5, vertrekAdres: eigen.vertrekAdres || '' }, clubAdres: '', googleBeschikbaar: false } : globaal
        }
        else if (url.pathname.includes('/aanvraaglink/')) body = { token: 'testtoken' }
        else if (url.pathname.endsWith('/planning/documenten')) body = { documenten: [], bijgewerkt: null, wachtendeMails: 0 }
        else if (url.pathname.endsWith('/gebruik')) body = { teams: [] }
        return req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: JSON.stringify(body) })
      })
      await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.instellingen-overzicht')
    }
    const klik = async tekst => {
      await page.waitForFunction(tekst => [...document.querySelectorAll('button')].some(b => b.firstChild?.firstChild?.textContent.trim() === tekst || b.firstChild?.textContent.trim() === tekst || b.textContent.trim() === tekst), {}, tekst)
      const gelukt = await page.evaluate(tekst => {
        const b = [...document.querySelectorAll('button')].find(b => b.firstChild?.firstChild?.textContent.trim() === tekst || b.firstChild?.textContent.trim() === tekst || b.textContent.trim() === tekst)
        if (!b) return false
        b.click(); return true
      }, tekst)
      assert.ok(gelukt, `Ontbrekende knop ${tekst}`)
    }
    const terug = async () => { await page.click('.instellingen-terug'); await page.waitForSelector('.instellingen-overzicht') }
    const heeftKnop = tekst => page.evaluate(tekst => [...document.querySelectorAll('button')].some(b => b.firstChild?.firstChild?.textContent.trim() === tekst || b.firstChild?.textContent.trim() === tekst || b.textContent.trim() === tekst), tekst)

    await open()
    await page.waitForFunction(() => document.body.textContent.includes('Alles bijgewerkt'), { timeout: 8000 }).catch(async e => {
      console.error(await page.evaluate(() => document.body.innerText), fouten)
      throw e
    })
    assert.equal(await page.$('input'), null)
    assert.equal(await heeftKnop('Uitloggen'), false)
    assert.equal(await heeftKnop('Nieuwe link maken'), false)
    assert.equal(await page.$eval('.instellingen-actief-label', n => n.textContent), 'Actief')
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Testteam 2')), false)
    assert.equal(await page.$eval('.instellingen-overzicht > .kijklink button', b => b.classList.contains('btn-primary')), true)
    if (process.env.PREVIEW_PATH) await page.screenshot({ path: process.env.PREVIEW_PATH })
    await klik('Teamlink delen')
    await page.waitForFunction(() => window.gedeeldeLinks.length === 1)
    assert.deepEqual(await page.evaluate(() => Object.keys(window.gedeeldeLinks[0])), ['url'])

    await klik('Teaminstellingen')
    await page.waitForFunction(() => document.body.textContent.includes('Je groep is vindbaar.'))
    assert.equal(await page.$('input[type="checkbox"]'), null)
    assert.equal(await heeftKnop('Nieuwe link maken'), true)
    assert.deepEqual(await page.$$eval('.team-optie', ns => ns.map(n => n.getAttribute('aria-checked'))), ['false', 'true'])
    await page.click('.team-optie[aria-label="Score bijhouden"]')
    await page.waitForFunction(() => document.querySelector('.team-optie[aria-label="Score bijhouden"]').getAttribute('aria-checked') === 'true')
    assert.equal(wijzigingen.at(-1).data.instellingen.speeltijdBijhouden, true)
    await page.click('.team-optie[aria-label="Speeltijd per positie"]')
    await page.waitForFunction(() => document.querySelector('.team-optie[aria-label="Speeltijd per positie"]').getAttribute('aria-checked') === 'false')
    instellingenFout = true
    await page.click('.team-optie[aria-label="Score bijhouden"]')
    await page.waitForFunction(() => document.body.textContent.includes('Instellingen niet opgeslagen'))
    assert.equal(await page.$eval('.team-optie[aria-label="Score bijhouden"]', n => n.getAttribute('aria-checked')), 'true')
    instellingenFout = false
    await page.setViewport({ width: 360, height: 640 })
    assert.ok(await page.$$eval('.team-optie', ns => ns.every(n => parseFloat(getComputedStyle(n).fontSize) >= 22 && n.getBoundingClientRect().height >= 60)))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    if (process.env.TEAM_PREVIEW_PATH) await page.screenshot({ path: process.env.TEAM_PREVIEW_PATH })
    await terug()
    await klik('Teaminstellingen')
    assert.deepEqual(await page.$$eval('.team-optie', ns => ns.map(n => n.getAttribute('aria-checked'))), ['true', 'false'])
    await terug()
    await klik('Verzameltijd')
    await page.waitForSelector('input[type="number"]:not(:disabled)')
    assert.equal(await page.$$eval('input[type="number"]', ns => ns.length), 2)
    assert.equal(await page.$('.verzamelen-instellen input[type="checkbox"]'), null)
    assert.deepEqual(await page.$$eval('input[type="number"]', ns => ns.map(n => n.value)), ['30', '5'])
    assert.equal(await page.$eval('.verzamelen-extra', el => el.open), false)
    const vulGetal = async (index, waarde) => {
      const velden = await page.$$('input[type="number"]')
      await velden[index].click({ clickCount: 3 })
      await page.keyboard.press('Backspace')
      if (waarde !== '') await velden[index].type(String(waarde))
    }
    await vulGetal(0, '')
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Opslaan').disabled), true)
    for (const ongeldig of ['361', '-1', '1.5']) {
      await vulGetal(0, ongeldig)
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Opslaan').disabled), true)
    }
    await vulGetal(0, '0')
    await vulGetal(1, '12')
    await page.click('.verzamelen-extra summary')
    await page.type('.verzamelen-extra input', 'Teststraat 1')
    await klik('Opslaan')
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Opslaan' && !b.disabled))
    const eigenTijden = wijzigingen.filter(w => w.pad.includes('/verzamelinstellingen')).at(-1)
    assert.deepEqual(eigenTijden.data, { voorbereidingMinuten: 0, bufferMinuten: 12, vertrekAdres: 'Teststraat 1' })
    await terug()
    await klik('Verzameltijd')
    await page.waitForFunction(() => document.querySelector('input[type="number"]').value === '0')
    assert.deepEqual(await page.$$eval('input[type="number"]', ns => ns.map(n => n.value)), ['0', '12'])
    const aantalPosts = wijzigingen.length
    await klik('Herstel standaardwaarden')
    assert.deepEqual(await page.$$eval('input[type="number"]', ns => ns.map(n => n.value)), ['30', '5'])
    assert.equal(wijzigingen.length, aantalPosts)
    await klik('Opslaan')
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Opslaan' && !b.disabled))
    const hersteld = wijzigingen.filter(w => w.pad.includes('/verzamelinstellingen')).at(-1)
    assert.deepEqual(hersteld.data, { voorbereidingMinuten: null, bufferMinuten: null, vertrekAdres: 'Teststraat 1' })
    if (process.env.REIS_PREVIEW_PATH) await page.screenshot({ path: process.env.REIS_PREVIEW_PATH })
    await terug()
    await klik('Verzameltijd')
    await page.waitForFunction(() => document.querySelector('input[type="number"]').value === '30')
    assert.deepEqual(await page.$$eval('input[type="number"]', ns => ns.map(n => n.value)), ['30', '5'])
    await terug()
    reisFout = true
    await klik('Verzameltijd')
    await page.waitForSelector('.verzamelen-instellen [role="alert"]')
    reisFout = false
    await klik('Opnieuw proberen')
    await page.waitForSelector('input[type="number"]:not(:disabled)')
    assert.deepEqual(await page.$$eval('input[type="number"]', ns => ns.map(n => n.value)), ['30', '5'])
    await terug()
    await klik('Leden')
    await page.waitForFunction(() => document.querySelector('.instellingen-kop-titel').textContent === 'Leden')
    await terug()

    await klik('Weergave')
    await klik('Licht')
    await terug()
    assert.equal(await page.$eval('html', el => el.dataset.thema), 'licht')
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.instellingen-menuregel')].some(b => b.textContent.includes('WeergaveLicht'))))
    await klik('Team wisselen')
    await klik('Testteam 2')
    await page.waitForFunction(() => document.querySelector('.instellingen-actief-team strong')?.textContent === 'Testteam 2')
    await klik('Team wisselen')
    await klik('Zonder team')
    await page.waitForFunction(() => document.querySelector('.instellingen-actief-team strong')?.textContent === 'Zonder team')
    assert.equal(await heeftKnop('Teaminstellingen'), false)
    assert.equal(await heeftKnop('Verzameltijd'), false)
    assert.equal(await heeftKnop('Teamlink delen'), false)
    await klik('Team wisselen')
    await klik('Aansluiten bij een team')
    await page.waitForSelector('input[type="search"]')
    await page.click('.instellingen-terug')
    await page.waitForFunction(() => document.querySelector('.instellingen-kop-titel').textContent === 'Team wisselen')
    await terug()
    await klik('Account')
    await klik('Uitloggen')
    await page.waitForFunction(() => document.body.textContent.includes('Wachtwoord vergeten'))

    await open({ kijker: true })
    for (const tekst of ['Leden', 'Teaminstellingen', 'Verzameltijd', 'Beheer']) assert.equal(await heeftKnop(tekst), false)
    assert.equal(await heeftKnop('Teamlink delen'), true)
    await page.setViewport({ width: 320, height: 640 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await klik('Weergave')
    await page.goBack()
    await page.waitForSelector('.instellingen-overzicht')

    await open({ superadmin: true, aanvragen: true })
    await klik('Aanvragen (1)')
    await page.waitForFunction(() => document.body.textContent.includes('Testaanvrager'))
    await terug()
    await klik('Beheer')
    await klik('Algemene verzameltijden')
    await page.waitForSelector('input[type="number"]')
    await page.click('.instellingen-terug')
    await klik('Planningsdocumenten')
    await page.waitForFunction(() => document.body.textContent.includes('Nog geen controles geregistreerd.'))
    await page.click('.instellingen-terug')
    await klik('Gebruik per team')
    await page.waitForFunction(() => document.querySelector('.instellingen-kop-titel').textContent === 'Gebruik per team')
    await page.click('.instellingen-terug')
    await terug()
    syncFout = true
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForSelector('.account-sync.fout')
    syncFout = false
    await page.click('.account-sync.fout')
    await page.waitForFunction(() => document.body.textContent.includes('Alles bijgewerkt'))
    assert.deepEqual(fouten, [])
    console.log('INSTELLINGEN_OK: compact overzicht, Actief-label, delen zonder tekst, vindbaarheid, leden, verzameltijd met standaardwaarden/herstel/validatie/laadherstel, thema, teamwissel, Zonder team, account/uitloggen, kijkerrechten, aanvragen, superadmin, terug en sync-herstel.')
  } finally { await browser.close() }
})().catch(err => { console.error(err); process.exit(1) })
