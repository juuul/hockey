// Volledige browserflow met fictieve accounts/API: geen echte data, mails of wijzigingen.
const assert = require('node:assert/strict')
const puppeteer = require('/usr/src/app/node_modules/puppeteer')
const appUrl = process.env.TEST_URL || 'http://127.0.0.1:5187/'
const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: 4000000000 })).toString('base64url')}.test`

;(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
  let page
  let syncFout = false
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
            const data = JSON.parse(req.postData()); wijzigingen.push({ pad: url.pathname, data })
            const team = teams.find(t => url.pathname.endsWith(t.id)); Object.assign(team, data); body = team
          } else body = lijst(teams)
        }
        else if (url.pathname.includes('/spelers/records') && syncFout) return req.abort('connectionfailed')
        else if (url.pathname.includes('/standen/records/')) body = { id: teams[0].id, versie: 0 }
        else if (url.pathname.includes('/toegangsaanvragen/records') && aanvragen) body = lijst([{ id: 'aanvraagtest', naam: 'Testaanvrager', email: 'aanvrager@example.invalid', team: teams[0].id }])
        else if (url.pathname.includes('/verzamelinstellingen')) {
          const globaal = { voorbereidingMinuten: 30, bufferMinuten: 5 }
          body = url.pathname.includes('/team/') ? { globaal, eigen: {}, effectief: { ...globaal, vertrekAdres: '' }, clubAdres: '', googleBeschikbaar: false } : globaal
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
    if (process.env.PREVIEW_PATH) await page.screenshot({ path: process.env.PREVIEW_PATH })
    await klik('Teamlink delen')
    await page.waitForFunction(() => window.gedeeldeLinks.length === 1)
    assert.deepEqual(await page.evaluate(() => Object.keys(window.gedeeldeLinks[0])), ['url'])

    await klik('Teaminstellingen')
    await page.waitForSelector('input[type="checkbox"]')
    assert.equal(await heeftKnop('Nieuwe link maken'), true)
    await page.click('input[type="checkbox"]')
    await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]').checked && !document.querySelector('input[type="checkbox"]').disabled)
    assert.equal(wijzigingen[0].data.vindbaar, false)
    await terug()
    await klik('Verzameltijd')
    await page.waitForSelector('input[type="number"]:not(:disabled)')
    assert.equal(await page.$$eval('input[type="number"]', ns => ns.length), 2)
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
    console.log('INSTELLINGEN_OK: compact overzicht, Actief-label, delen zonder tekst, vindbaarheid, leden, verzameltijd, thema, teamwissel, Zonder team, account/uitloggen, kijkerrechten, aanvragen, superadmin, terug en sync-herstel.')
  } finally { await browser.close() }
})().catch(err => { console.error(err); process.exit(1) })
